import os
from copy import deepcopy
from typing import Any, Dict, List, Tuple

from flask import Flask, Response
from pydantic import BaseModel


class ServiceDocMetadata(BaseModel):
    service_name: str
    version: str
    base_url: str


def _truthy(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _convert_rule_to_openapi(rule: str) -> str:
    converted = rule
    while "<" in converted and ">" in converted:
        left = converted.index("<")
        right = converted.index(">", left)
        token = converted[left + 1 : right]
        name = token.split(":", 1)[-1]
        converted = f"{converted[:left]}{{{name}}}{converted[right + 1:]}"
    return converted


def _path_parameters(rule: str) -> List[Dict[str, Any]]:
    params = []
    chunks = [chunk for chunk in rule.split("/") if chunk.startswith("<") and chunk.endswith(">")]
    for chunk in chunks:
        inner = chunk[1:-1]
        if ":" in inner:
            param_type, name = inner.split(":", 1)
        else:
            param_type, name = "string", inner

        schema_type = "integer" if param_type in {"int", "integer"} else "string"
        params.append(
            {
                "name": name,
                "in": "path",
                "required": True,
                "schema": {"type": schema_type},
            }
        )
    return params


_OPERATION_HINTS: Dict[Tuple[str, str], Dict[str, Any]] = {
    (
        "get",
        "/swap-orchestrator/cycles",
    ): {
        "summary": "List swap cycles",
        "description": "Returns swap cycles with optional section and course filters.",
        "parameters": [
            {
                "name": "section_id",
                "in": "query",
                "required": False,
                "description": "Filter by section UUID.",
                "schema": {"type": "string", "format": "uuid"},
            },
            {
                "name": "course_id",
                "in": "query",
                "required": False,
                "description": "Filter by integer course identifier.",
                "schema": {"type": "integer"},
                "example": 12345,
            },
        ],
        "responses": {
            "200": {"description": "Cycles returned"},
            "400": {"description": "Invalid query parameter value"},
        },
    },
    (
        "post",
        "/swap-orchestrator/cycles",
    ): {
        "summary": "Create swap cycle",
        "description": "Creates a swap cycle and initializes or reuses swap constraints.",
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": [
                            "section_id",
                            "course_id",
                            "module_id",
                            "class_id",
                            "open_at",
                            "close_at",
                        ],
                        "properties": {
                            "section_id": {"type": "string", "format": "uuid"},
                            "course_id": {"type": "integer", "example": 12345},
                            "module_id": {"type": "string", "format": "uuid"},
                            "class_id": {"type": "string", "format": "uuid"},
                            "open_at": {
                                "type": "string",
                                "format": "date-time",
                                "example": "2026-04-05T03:00:00Z",
                            },
                            "close_at": {
                                "type": "string",
                                "format": "date-time",
                                "example": "2026-04-06T03:00:00Z",
                            },
                            "created_by": {"type": "string"},
                            "constraints": {
                                "type": "object",
                                "properties": {
                                    "gpa_variance_level": {
                                        "type": "string",
                                        "enum": ["strict", "standard", "none"],
                                    },
                                    "class_avg_gpa": {"type": "number"},
                                    "require_year_diversity": {"type": "boolean"},
                                    "max_skill_imbalance": {"type": "number"},
                                    "swap_window_days": {"type": "integer"},
                                },
                            },
                        },
                    }
                }
            },
        },
        "responses": {
            "201": {"description": "Cycle created"},
            "400": {"description": "Validation error"},
            "409": {"description": "Conflict from upstream constraints"},
            "502": {"description": "Upstream service error"},
        },
    },
    (
        "post",
        "/swap-orchestrator/cycles/{cycle_id}/requests",
    ): {
        "summary": "Submit swap request",
        "description": "Creates a swap request and maps it to a cycle.",
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["student_id", "current_team", "reason"],
                        "properties": {
                            "student_id": {"type": "integer"},
                            "current_team": {"type": "string", "format": "uuid"},
                            "reason": {"type": "string"},
                        },
                    }
                }
            },
        },
        "responses": {
            "201": {"description": "Swap request submitted"},
            "400": {"description": "Validation error"},
            "404": {"description": "Cycle not found"},
            "409": {"description": "Cycle state conflict"},
        },
    },
    (
        "get",
        "/swap-orchestrator/cycles/{cycle_id}/requests/processed",
    ): {
        "summary": "List processed cycle requests",
        "description": "Returns frontend-oriented swap request rows for a cycle.",
        "parameters": [
            {
                "name": "status",
                "in": "query",
                "required": False,
                "description": "Optional lowercase status filter.",
                "schema": {
                    "type": "string",
                    "enum": ["pending", "approved", "rejected", "executed", "failed"],
                },
            }
        ],
    },
    (
        "patch",
        "/swap-orchestrator/cycles/{cycle_id}/requests/{swap_request_id}/decision",
    ): {
        "summary": "Decide swap request",
        "description": "Approves or rejects a mapped swap request.",
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["decision"],
                        "properties": {
                            "decision": {
                                "type": "string",
                                "enum": ["APPROVED", "REJECTED"],
                            }
                        },
                    }
                }
            },
        },
    },
    (
        "get",
        "/swap-orchestrator/student-team",
    ): {
        "summary": "Get student team",
        "description": "Returns a student's current team assignment for a section.",
        "parameters": [
            {
                "name": "section_id",
                "in": "query",
                "required": True,
                "schema": {"type": "string", "format": "uuid"},
            },
            {
                "name": "student_id",
                "in": "query",
                "required": True,
                "schema": {"type": "integer"},
            },
        ],
    },
}


def _merge_parameters(
    path_parameters: List[Dict[str, Any]],
    hint_parameters: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    merged: List[Dict[str, Any]] = []
    seen = set()

    for param in path_parameters + hint_parameters:
        key = (param.get("name"), param.get("in"))
        if key in seen:
            continue
        seen.add(key)
        merged.append(param)

    return merged


def _build_openapi_spec(app: Flask, metadata: ServiceDocMetadata) -> Dict[str, Any]:
    paths: Dict[str, Dict[str, Any]] = {}
    tags = set()

    excluded = {"/openapi.json", "/docs", "/docs-index", "/static/<path:filename>"}

    for rule in app.url_map.iter_rules():
        if rule.rule in excluded or rule.endpoint == "static":
            continue

        methods = sorted(m for m in rule.methods if m not in {"HEAD", "OPTIONS"})
        if not methods:
            continue

        openapi_path = _convert_rule_to_openapi(rule.rule)
        first_segment = (openapi_path.strip("/").split("/") or ["default"])[0] or "default"
        tag = first_segment.replace("-", " ").title().replace(" ", "-")
        tags.add(tag)
        params = _path_parameters(rule.rule)

        if openapi_path not in paths:
            paths[openapi_path] = {}

        for method in methods:
            operation_hints = deepcopy(_OPERATION_HINTS.get((method.lower(), openapi_path), {}))
            operation = {
                "summary": f"{method} {openapi_path}",
                "description": f"Auto-generated contract for {rule.endpoint}.",
                "operationId": rule.endpoint,
                "tags": [tag],
                "responses": {
                    "200": {"description": "Successful response"},
                    "400": {"description": "Bad request"},
                    "500": {"description": "Internal server error"},
                },
            }

            if "summary" in operation_hints:
                operation["summary"] = operation_hints["summary"]
            if "description" in operation_hints:
                operation["description"] = operation_hints["description"]
            if "operationId" in operation_hints:
                operation["operationId"] = operation_hints["operationId"]
            if "tags" in operation_hints:
                operation["tags"] = operation_hints["tags"]

            hint_responses = operation_hints.get("responses")
            if isinstance(hint_responses, dict):
                operation["responses"] = {**operation["responses"], **hint_responses}

            hint_parameters = operation_hints.get("parameters")
            if not isinstance(hint_parameters, list):
                hint_parameters = []
            merged_parameters = _merge_parameters(params, hint_parameters)
            if merged_parameters:
                operation["parameters"] = merged_parameters

            if method in {"POST", "PUT", "PATCH"}:
                operation["requestBody"] = {
                    "required": False,
                    "content": {
                        "application/json": {
                            "schema": {"type": "object"}
                        }
                    },
                }

            if "requestBody" in operation_hints:
                operation["requestBody"] = operation_hints["requestBody"]

            paths[openapi_path][method.lower()] = operation

    return {
        "openapi": "3.0.3",
        "info": {
            "title": f"{metadata.service_name} API",
            "version": metadata.version,
            "description": f"Swagger documentation for {metadata.service_name}.",
        },
        "servers": [{"url": metadata.base_url}],
        "tags": [{"name": tag} for tag in sorted(tags)],
        "paths": paths,
    }


def register_swagger(app: Flask, default_service_name: str) -> None:
    if not _truthy(os.getenv("ENABLE_SWAGGER", "false")):
        return

    service_name = os.getenv("SERVICE_NAME", default_service_name)
    version = os.getenv("SERVICE_VERSION", "1.0.0")
    base_url = os.getenv("SERVICE_BASE_URL", f"http://localhost:{os.getenv('PORT', '80')}")
    metadata = ServiceDocMetadata(service_name=service_name, version=version, base_url=base_url)

    @app.get("/openapi.json")
    def openapi_spec():
        return _build_openapi_spec(app, metadata)

    @app.get("/docs")
    def swagger_ui():
        html = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>{title}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {{
      window.ui = SwaggerUIBundle({{
        url: '{openapi_url}',
        dom_id: '#swagger-ui'
      }});
    }};
  </script>
</body>
</html>""".format(title=f"{service_name} Swagger UI", openapi_url="/openapi.json")
        return Response(html, mimetype="text/html")