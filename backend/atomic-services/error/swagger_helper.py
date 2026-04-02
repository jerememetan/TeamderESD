import os
from typing import Any, Dict


def _truthy(value: str) -> bool:
	return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _service_metadata(default_service_name: str) -> Dict[str, str]:
	return {
		"service_name": os.getenv("SERVICE_NAME", default_service_name),
		"version": os.getenv("SERVICE_VERSION", "1.0.0"),
		"base_url": os.getenv("SERVICE_BASE_URL", f"http://localhost:{os.getenv('PORT', '3019')}"),
	}


def _openapi_spec(metadata: Dict[str, str]) -> Dict[str, Any]:
	error_log_schema = {
		"type": "object",
		"properties": {
			"id": {"type": "integer"},
			"created_at": {"type": "string", "format": "date-time"},
			"source_service": {"type": "string"},
			"routing_key": {"type": "string"},
			"error_code": {"type": ["string", "null"]},
			"error_message": {"type": "string"},
			"correlation_id": {"type": ["string", "null"]},
			"context_json": {"type": ["object", "array", "null"], "additionalProperties": True},
			"status": {"type": "string"},
		},
		"required": ["id", "created_at", "source_service", "routing_key", "error_message", "status"],
	}

	return {
		"openapi": "3.0.3",
		"info": {
			"title": f"{metadata['service_name']} API",
			"version": metadata["version"],
			"description": "Swagger documentation for the error log service.",
		},
		"servers": [{"url": metadata["base_url"]}],
		"paths": {
			"/health": {
				"get": {
					"summary": "GET /health",
					"tags": ["Health"],
					"responses": {
						"200": {
							"description": "Service health",
							"content": {
								"application/json": {
									"schema": {
										"type": "object",
										"properties": {
											"data": {
												"type": "object",
												"properties": {
													"status": {"type": "string"},
													"service": {"type": "string"},
												},
											},
											"meta": {"type": "object"},
										},
									}
								}
							},
						}
					},
				}
			},
			"/errors": {
				"get": {
					"summary": "List error logs",
					"tags": ["Error Logs"],
					"parameters": [
						{"name": "page", "in": "query", "schema": {"type": "integer", "default": 1}},
						{"name": "page_size", "in": "query", "schema": {"type": "integer", "default": 25}},
						{"name": "source_service", "in": "query", "schema": {"type": "string"}},
						{"name": "routing_key", "in": "query", "schema": {"type": "string"}},
						{"name": "status", "in": "query", "schema": {"type": "string"}},
						{"name": "correlation_id", "in": "query", "schema": {"type": "string"}},
					],
					"responses": {
						"200": {
							"description": "A paginated list of error logs",
							"content": {
								"application/json": {
									"schema": {
										"type": "object",
										"properties": {
											"data": {"type": "array", "items": error_log_schema},
											"meta": {
												"type": "object",
												"properties": {
													"page": {"type": "integer"},
													"page_size": {"type": "integer"},
													"total": {"type": "integer"},
													"total_pages": {"type": "integer"},
												},
											},
										},
									}
								}
							},
						},
						"400": {
							"description": "Invalid pagination query parameters",
							"content": {
								"application/json": {
									"schema": {
										"type": "object",
										"properties": {
											"error": {
												"type": "object",
												"properties": {
													"code": {"type": "string"},
													"message": {"type": "string"},
												},
											}
										},
									}
								}
							},
						},
					},
				}
			},
			"/errors/{error_id}": {
				"get": {
					"summary": "Get an error log by id",
					"tags": ["Error Logs"],
					"parameters": [
						{"name": "error_id", "in": "path", "required": True, "schema": {"type": "integer"}},
					],
					"responses": {
						"200": {
							"description": "Single error log",
							"content": {"application/json": {"schema": {"type": "object", "properties": {"data": error_log_schema, "meta": {"type": "object"}}}}},
						},
						"404": {
							"description": "Error log not found",
							"content": {
								"application/json": {
									"schema": {
										"type": "object",
										"properties": {
											"error": {
												"type": "object",
												"properties": {
													"code": {"type": "string"},
													"message": {"type": "string"},
												},
											}
										},
									}
								}
							},
						},
					},
				},
				"delete": {
					"summary": "Delete an error log",
					"tags": ["Error Logs"],
					"parameters": [
						{"name": "error_id", "in": "path", "required": True, "schema": {"type": "integer"}},
					],
					"responses": {
						"200": {
							"description": "Soft-deleted error log",
							"content": {"application/json": {"schema": {"type": "object", "properties": {"data": error_log_schema, "meta": {"type": "object"}}}}},
						},
						"404": {
							"description": "Error log not found",
							"content": {
								"application/json": {
									"schema": {
										"type": "object",
										"properties": {
											"error": {
												"type": "object",
												"properties": {
													"code": {"type": "string"},
													"message": {"type": "string"},
												},
											}
										},
									}
								}
							},
						},
					},
				},
			},
		},
		"tags": [
			{"name": "Health"},
			{"name": "Error Logs"},
		],
	}


def register_swagger(app, default_service_name: str) -> None:
		if not _truthy(os.getenv("ENABLE_SWAGGER", "false")):
				return

		metadata = _service_metadata(default_service_name)

		@app.get("/openapi.json")
		def openapi_spec():
				return _openapi_spec(metadata)

		@app.get("/docs")
		def swagger_ui():
				html = """<!DOCTYPE html>
<html>
<head>
	<meta charset=\"utf-8\" />
	<title>{title}</title>
	<link rel=\"stylesheet\" href=\"https://unpkg.com/swagger-ui-dist@5/swagger-ui.css\" />
</head>
<body>
	<div id=\"swagger-ui\"></div>
	<script src=\"https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js\"></script>
	<script>
		window.onload = function() {{
			window.ui = SwaggerUIBundle({{
				url: '/openapi.json',
				dom_id: '#swagger-ui'
			}});
		}};
	</script>
</body>
</html>""".format(title=f"{metadata['service_name']} Swagger UI")
				return html
