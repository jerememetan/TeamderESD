import os
from typing import Any, Dict, List

from flask import Flask, Response
from pydantic import BaseModel

# Optional marshmallow support
try:
    import marshmallow
    from marshmallow import Schema as MarshmallowSchema
    from marshmallow import fields as ma_fields
    _HAS_MARSHMALLOW = True
except Exception:
    MarshmallowSchema = None  # type: ignore
    ma_fields = None  # type: ignore
    _HAS_MARSHMALLOW = False


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


def _marshmallow_schema_to_openapi(schema: "MarshmallowSchema") -> Dict[str, Any]:
    props: Dict[str, Any] = {}
    required: List[str] = []

    def _field_to_schema(field) -> Dict[str, Any]:
        if ma_fields is None:
            return {"type": "string"}

        if isinstance(field, ma_fields.Integer) or field.__class__.__name__ in {"Integer", "Int"}:
            return {"type": "integer"}
        if isinstance(field, ma_fields.UUID) or field.__class__.__name__ == "UUID":
            return {"type": "string", "format": "uuid"}
        if isinstance(field, ma_fields.Boolean) or field.__class__.__name__ == "Boolean":
            return {"type": "boolean"}
        if isinstance(field, ma_fields.DateTime) or field.__class__.__name__ == "DateTime":
            return {"type": "string", "format": "date-time"}
        if isinstance(field, ma_fields.Float) or field.__class__.__name__ == "Float":
            return {"type": "number"}
        if isinstance(field, ma_fields.Str) or field.__class__.__name__ in {"Str", "String"}:
            return {"type": "string"}

        inner = getattr(field, "inner", None) or getattr(field, "container", None)
        if inner is not None:
            return {"type": "array", "items": _field_to_schema(inner)}

        nested = getattr(field, "nested", None) or getattr(field, "schema", None)
        if nested is not None:
            try:
                if isinstance(nested, type) and issubclass(nested, MarshmallowSchema):
                    nested_inst = nested()
                    return _marshmallow_schema_to_openapi(nested_inst)
                if isinstance(nested, MarshmallowSchema):
                    return _marshmallow_schema_to_openapi(nested)
            except Exception:
                return {"type": "object"}

        return {"type": "string"}

    for name, field in getattr(schema, "fields", {}).items():
        props[name] = _field_to_schema(field)
        try:
            if getattr(field, "required", False):
                required.append(name)
        except Exception:
            pass

    schema_obj: Dict[str, Any] = {"type": "object", "properties": props}
    if required:
        schema_obj["required"] = required
    return schema_obj


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

            # If marshmallow is available, allow view functions to provide
            # `_openapi_request_schema` and `_openapi_response_schema` (Schema instances)
            view_func = app.view_functions.get(rule.endpoint)
            if _HAS_MARSHMALLOW and view_func is not None:
                req_schema = getattr(view_func, "_openapi_request_schema", None)
                res_schema = getattr(view_func, "_openapi_response_schema", None)

                def _convert(schema_obj: Any) -> Dict[str, Any]:
                    if schema_obj is None:
                        return {"type": "object"}
                    schema_inst = schema_obj
                    if isinstance(schema_obj, type) and issubclass(schema_obj, MarshmallowSchema):
                        schema_inst = schema_obj()
                    if isinstance(schema_inst, MarshmallowSchema):
                        return _marshmallow_schema_to_openapi(schema_inst)
                    return {"type": "object"}

                if req_schema is not None:
                    operation["requestBody"] = {
                        "required": False,
                        "content": {"application/json": {"schema": _convert(req_schema)}},
                    }

                if res_schema is not None:
                    operation.setdefault("responses", {})
                    operation["responses"]["200"] = {
                        "description": "Successful response",
                        "content": {"application/json": {"schema": _convert(res_schema)}},
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