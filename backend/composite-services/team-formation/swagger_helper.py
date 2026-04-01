import os
from typing import Any, Dict, List

from flask import Flask, Response
from pydantic import BaseModel
import importlib


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

            if method in {"POST", "PUT", "PATCH"}:
                operation["requestBody"] = {
                    "required": False,
                    "content": {
                        "application/json": {
                            "schema": {"type": "object"}
                        }
                    },
                }

            # attach marshmallow-derived schemas if view has them
            try:
                view_fn = app.view_functions.get(rule.endpoint)
            except Exception:
                view_fn = None

            if view_fn is not None:
                resp_schema = getattr(view_fn, "_openapi_response_schema", None)
                if resp_schema is not None:
                    schema_obj = _convert_marshmallow_schema(resp_schema)
                    operation.setdefault("responses", {})["200"] = {
                        "description": "Successful response",
                        "content": {"application/json": {"schema": schema_obj}},
                    }

                req_schema = getattr(view_fn, "_openapi_request_schema", None)
                if req_schema is not None and method in {"POST", "PUT", "PATCH"}:
                    schema_obj = _convert_marshmallow_schema(req_schema)
                    operation["requestBody"] = {
                        "required": True,
                        "content": {"application/json": {"schema": schema_obj}},
                    }

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


def _convert_marshmallow_schema(schema_cls_or_instance) -> Dict[str, Any]:
    try:
        marshmallow = importlib.import_module("marshmallow")
    except Exception:
        return {"type": "object"}

    fields_mod = getattr(marshmallow, "fields", None)
    if fields_mod is None:
        return {"type": "object"}

    if isinstance(schema_cls_or_instance, type):
        try:
            schema = schema_cls_or_instance()
        except Exception:
            schema = schema_cls_or_instance
    else:
        schema = schema_cls_or_instance

    if not hasattr(schema, "fields"):
        return {"type": "object"}

    def field_to_schema(field):
        if isinstance(field, fields_mod.String):
            return {"type": "string"}
        if isinstance(field, fields_mod.Integer):
            return {"type": "integer"}
        if isinstance(field, fields_mod.Float) or isinstance(field, fields_mod.Number):
            return {"type": "number", "format": "float"}
        if isinstance(field, fields_mod.Boolean):
            return {"type": "boolean"}
        if isinstance(field, fields_mod.List):
            inner = field_to_schema(field.inner) if hasattr(field, "inner") else {"type": "string"}
            return {"type": "array", "items": inner}
        if isinstance(field, fields_mod.Nested):
            nested = field.nested
            try:
                nested_schema = nested() if isinstance(nested, type) else nested
            except Exception:
                nested_schema = nested
            if hasattr(nested_schema, "fields"):
                props, required = {}, []
                for k, f in nested_schema.fields.items():
                    props[k] = field_to_schema(f)
                    if getattr(f, "required", False):
                        required.append(k)
                out = {"type": "object", "properties": props}
                if required:
                    out["required"] = required
                return out
            return {"type": "object"}
        return {"type": "string"}

    properties = {}
    required = []
    for name, field in getattr(schema, "fields", {}).items():
        properties[name] = field_to_schema(field)
        if getattr(field, "required", False):
            required.append(name)

    result = {"type": "object", "properties": properties}
    if required:
        result["required"] = required
    return result


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