import os
from typing import Any, Dict, List

try:
    from marshmallow import Schema as MarshmallowSchema, fields as mfields
except Exception:
    MarshmallowSchema = None
    mfields = None

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


def _marshmallow_schema_to_openapi(schema: Any) -> Dict[str, Any]:
    """Convert a marshmallow.Schema instance to a minimal OpenAPI schema object.

    Supports common field types used across these microservices.
    """
    if MarshmallowSchema is None or mfields is None:
        raise RuntimeError("marshmallow is required for schema conversion")

    # Accept Schema class or instance
    if isinstance(schema, type) and issubclass(schema, MarshmallowSchema):
        schema = schema()

    # Handle many=True wrapper if present
    if getattr(schema, "many", False):
        # marshmallow may store inner container in _container
        inner = getattr(schema, "_container", None)
        if inner is not None:
            return {"type": "array", "items": _marshmallow_schema_to_openapi(inner)}
        # fallback
        return {"type": "array", "items": {"type": "object"}}

    properties: Dict[str, Any] = {}
    required: List[str] = []
    for name, field in getattr(schema, "fields", {}).items():
        prop: Dict[str, Any] = {}
        try:
            if isinstance(field, mfields.Integer):
                prop["type"] = "integer"
            elif isinstance(field, mfields.UUID):
                prop["type"] = "string"
                prop["format"] = "uuid"
            elif isinstance(field, mfields.Boolean):
                prop["type"] = "boolean"
            elif isinstance(field, mfields.DateTime):
                prop["type"] = "string"
                prop["format"] = "date-time"
            elif isinstance(field, mfields.List):
                inner = getattr(field, "inner", None)
                if inner is not None:
                    if hasattr(inner, "fields"):
                        items = _marshmallow_schema_to_openapi(inner)
                    else:
                        if isinstance(inner, mfields.Integer):
                            items = {"type": "integer"}
                        else:
                            items = {"type": "string"}
                    prop = {"type": "array", "items": items}
                else:
                    prop = {"type": "array", "items": {"type": "string"}}
            elif isinstance(field, mfields.Nested):
                nested_schema = getattr(field, "schema", None) or (field.nested() if callable(field.nested) else None)
                if nested_schema is not None:
                    prop = _marshmallow_schema_to_openapi(nested_schema)
                else:
                    prop = {"type": "object"}
            else:
                prop["type"] = "string"
        except Exception:
            prop["type"] = "string"

        if getattr(field, "required", False):
            required.append(name)
        properties[name] = prop

    result: Dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        result["required"] = required
    return result


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
            operation = {
                "summary": f"{method} {openapi_path}",
                "description": f"Auto-generated contract for `{rule.endpoint}`.",
                "tags": [tag],
                "responses": {
                    "200": {"description": "Successful response"},
                    "400": {"description": "Bad request"},
                    "500": {"description": "Internal server error"},
                },
            }

            if params:
                operation["parameters"] = params

            # Allow endpoint-specific parameter annotations (query/header/cookie).
            view_func = app.view_functions.get(rule.endpoint)
            extra_parameters = getattr(view_func, "_openapi_parameters", None) if view_func is not None else None
            if isinstance(extra_parameters, list) and extra_parameters:
                operation.setdefault("parameters", []).extend(extra_parameters)

            if method in {"POST", "PUT", "PATCH"}:
                operation["requestBody"] = {
                    "required": False,
                    "content": {
                        "application/json": {
                            "schema": {"type": "object"}
                        }
                    },
                }

            # If the view function has marshmallow schema annotations, convert them
            if view_func is not None and MarshmallowSchema is not None:
                # response schema (marshmallow.Schema instance)
                resp_schema = getattr(view_func, "_openapi_response_schema", None)
                if resp_schema is not None:
                    try:
                        converted = _marshmallow_schema_to_openapi(resp_schema)
                        # wrap into standard response envelope if handler uses {code,data}
                        operation["responses"] = {
                            "200": {
                                "description": "Successful response",
                                "content": {
                                    "application/json": {
                                        "schema": converted
                                    }
                                }
                            }
                        }
                    except Exception:
                        pass

                # Allow explicit OpenAPI responses override for complex contracts (e.g. oneOf).
                explicit_responses = getattr(view_func, "_openapi_responses", None)
                if isinstance(explicit_responses, dict) and explicit_responses:
                    operation["responses"] = explicit_responses

                # request schema (for POST/PUT/PATCH)
                req_schema = getattr(view_func, "_openapi_request_schema", None)
                if req_schema is not None and method in {"POST", "PUT", "PATCH"}:
                    try:
                        req_converted = _marshmallow_schema_to_openapi(req_schema)
                        operation["requestBody"] = {
                            "required": False,
                            "content": {
                                "application/json": {"schema": req_converted}
                            },
                        }
                    except Exception:
                        pass

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