import os
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape
from typing import Any, Dict, List, Optional

import requests
from flask import Flask, Response, jsonify, request


app = Flask(__name__)


@dataclass(frozen=True)
class ServiceDoc:
    service_name: str
    scope: str
    base_url: str
    api_base_path: str
    endpoint_examples: List[str]
    swagger_available: bool = True
    managed_in_backend_compose: bool = True

    @property
    def docs_url(self) -> Optional[str]:
        if not self.swagger_available:
            return None
        return f"{self.base_url}/docs"

    @property
    def openapi_url(self) -> Optional[str]:
        if not self.swagger_available:
            return None
        return f"{self.base_url}/openapi.json"


ATOMIC_SERVICES: List[ServiceDoc] = [
    ServiceDoc("student-service", "atomic", "http://localhost:3001", "/api/students", ["/api/students"], managed_in_backend_compose=False),
    ServiceDoc("skill-service", "atomic", "http://localhost:3002", "/skill", ["/skill", "/skill/{id}"]),
    ServiceDoc("topic-service", "atomic", "http://localhost:3003", "/topic", ["/topic", "/topic/{id}"]),
    ServiceDoc("criteria-service", "atomic", "http://localhost:3004", "/criteria", ["/criteria"]),
    ServiceDoc("enrollment-service", "atomic", "http://localhost:3005", "/enrollment", ["/enrollment"]),
    ServiceDoc("reputation-service", "atomic", "http://localhost:3006", "/reputation", ["/reputation", "/reputation/{id}"]),
    ServiceDoc("team-service", "atomic", "http://localhost:3007", "/team", ["/team"]),
    ServiceDoc("student-competence-service", "atomic", "http://localhost:3008", "/competence", ["/competence"]),
    ServiceDoc("student-topic-preference-service", "atomic", "http://localhost:3009", "/topic-preference", ["/topic-preference"]),
    ServiceDoc("student-form-data-service", "atomic", "http://localhost:3010", "/form-data", ["/form-data"]),
    ServiceDoc("swap-request-service", "atomic", "http://localhost:3011", "/swap-request", ["/swap-request"]),
    ServiceDoc("team-swap-service", "atomic", "http://localhost:3013", "/team-swap", ["/team-swap", "/team-swap/execute"]),
    ServiceDoc("student-form-service", "atomic", "http://localhost:3015", "/student-form", ["/student-form", "/student-form/submissions"]),
    ServiceDoc("notification-service", "atomic", "http://localhost:3016", "/notification", ["/health", "/notification/send-form-link", "/notification/publish-email"]),
    ServiceDoc("course-service", "atomic", "http://localhost:3017", "/api/courses", ["/api/courses"], managed_in_backend_compose=False),
    ServiceDoc("section-service", "atomic", "http://localhost:3018", "/section", ["/section", "/section/{id}"]),
    ServiceDoc("error-service", "atomic", "http://localhost:3019", "/errors", ["/errors", "/errors/{id}"]),
    ServiceDoc("peer-evaluation-service", "atomic", "http://localhost:3020", "/peer-eval/rounds", ["/peer-eval/health", "/peer-eval/rounds", "/peer-eval/rounds/{round_id}/close"], swagger_available=False),
]

COMPOSITE_SERVICES: List[ServiceDoc] = [
    ServiceDoc("formation-config-service", "composite", "http://localhost:4000", "/formation-config", ["/formation-config", "/health"]),
    ServiceDoc("student-profile-service", "composite", "http://localhost:4001", "/student-profile", ["/student-profile", "/health"]),
    ServiceDoc("team-formation-service", "composite", "http://localhost:4002", "/team-formation", ["/team-formation", "/teams", "/health"]),
    ServiceDoc("dashboard-orchestrator-service", "composite", "http://localhost:4003", "/dashboard", ["/dashboard", "/dashboard/peer-eval/initiate", "/dashboard/peer-eval/close", "/dashboard/health"]),
    ServiceDoc("formation-notification-service", "composite", "http://localhost:4004", "/formation-notifications", ["/formation-notifications", "/health"]),
    ServiceDoc("swap-orchestrator-service", "composite", "http://localhost:4005", "/swap-orchestrator", ["/swap-orchestrator/submission/requests", "/swap-orchestrator/review/requests", "/swap-orchestrator/review/requests/{swap_request_id}/decision", "/swap-orchestrator/sections/{section_id}/confirm", "/swap-orchestrator/student-team", "/health"]),
    ServiceDoc("student-form-submission-service", "composite", "http://localhost:4006", "/student-form-submission", ["/student-form-submission/submit"]),
    ServiceDoc("peer-eval-notification-service", "composite", "http://localhost:4008", "/peer-eval-notifications", ["/peer-eval-notifications/health", "/peer-eval-notifications/initiate", "/peer-eval-notifications/close"]),
]


def _get_services(scope: str) -> List[ServiceDoc]:
    normalized = scope.strip().lower()
    if normalized == "atomic":
        return ATOMIC_SERVICES
    if normalized == "composite":
        return COMPOSITE_SERVICES
    return [*ATOMIC_SERVICES, *COMPOSITE_SERVICES]


def _service_payload(svc: ServiceDoc) -> Dict[str, Any]:
    return {
        "service": svc.service_name,
        "scope": svc.scope,
        "base_url": svc.base_url,
        "api_base_path": svc.api_base_path,
        "endpoint_examples": svc.endpoint_examples,
        "swagger_available": svc.swagger_available,
        "swagger_ui_url": svc.docs_url,
        "openapi_json_url": svc.openapi_url,
        "managed_in_backend_compose": svc.managed_in_backend_compose,
    }


def _validate_openapi_json(doc: Any) -> List[str]:
    issues: List[str] = []
    if not isinstance(doc, dict):
        return ["OpenAPI response is not a JSON object."]

    if not isinstance(doc.get("openapi"), str):
        issues.append("Missing or invalid 'openapi' version field.")

    if not isinstance(doc.get("info"), dict):
        issues.append("Missing or invalid 'info' object.")

    if not isinstance(doc.get("paths"), dict):
        issues.append("Missing or invalid 'paths' object.")

    return issues


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "swagger-index-service",
        "atomic_services": len(ATOMIC_SERVICES),
        "composite_services": len(COMPOSITE_SERVICES),
        "total_services": len(ATOMIC_SERVICES) + len(COMPOSITE_SERVICES),
    }


@app.get("/services")
@app.get("/docs-index.json")
def services_index_json():
    scope = request.args.get("scope", "atomic")
    services = _get_services(scope)
    payload = [_service_payload(svc) for svc in services]
    return jsonify({"data": payload, "meta": {"count": len(payload), "scope": scope}})


@app.get("/audit/openapi")
def audit_openapi():
    timeout_seconds = float(os.getenv("OPENAPI_AUDIT_TIMEOUT_SECONDS", "2.5"))
    scope = request.args.get("scope", "atomic")
    services = _get_services(scope)
    checks: List[Dict[str, Any]] = []

    for svc in services:
        base = _service_payload(svc)

        if not svc.swagger_available or not svc.openapi_url:
            checks.append(
                {
                    **base,
                    "status": "skipped",
                    "issues": ["Swagger/OpenAPI endpoint is not enabled for this service."],
                }
            )
            continue

        try:
            response = requests.get(svc.openapi_url, timeout=timeout_seconds)
            status_code = response.status_code
            if status_code != 200:
                checks.append(
                    {
                        **base,
                        "status": "error",
                        "http_status": status_code,
                        "issues": [f"Expected HTTP 200 from openapi endpoint, received {status_code}."],
                    }
                )
                continue

            try:
                openapi_json = response.json()
            except ValueError:
                checks.append(
                    {
                        **base,
                        "status": "error",
                        "http_status": status_code,
                        "issues": ["OpenAPI endpoint did not return valid JSON."],
                    }
                )
                continue

            issues = _validate_openapi_json(openapi_json)
            checks.append(
                {
                    **base,
                    "status": "ok" if not issues else "error",
                    "http_status": status_code,
                    "issues": issues,
                    "paths_count": len(openapi_json.get("paths", {})) if isinstance(openapi_json.get("paths"), dict) else 0,
                }
            )
        except requests.RequestException as exc:
            checks.append(
                {
                    **base,
                    "status": "error",
                    "issues": [f"Request failed: {exc.__class__.__name__}"],
                }
            )

    has_errors = any(item["status"] == "error" for item in checks)
    return jsonify(
        {
            "data": checks,
            "meta": {
                "count": len(checks),
                "scope": scope,
                "has_errors": has_errors,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        }
    )


@app.get("/")
@app.get("/docs-index")
def docs_index():
    scope = request.args.get("scope", "atomic")
    services = _get_services(scope)
    rows = []
    for svc in services:
        docs_link = (
            f"<a href='{escape(svc.docs_url)}' target='_blank'>{escape(svc.docs_url)}</a>"
            if svc.docs_url
            else "n/a"
        )
        openapi_link = (
            f"<a href='{escape(svc.openapi_url)}' target='_blank'>{escape(svc.openapi_url)}</a>"
            if svc.openapi_url
            else "n/a"
        )
        compose_state = "yes" if svc.managed_in_backend_compose else "no"
        endpoint_examples = "<br/>".join(escape(item) for item in svc.endpoint_examples)
        rows.append(
            "<tr>"
            f"<td>{escape(svc.scope)}</td>"
            f"<td>{escape(svc.service_name)}</td>"
            f"<td><a href='{escape(svc.base_url)}' target='_blank'>{escape(svc.base_url)}</a></td>"
            f"<td>{escape(svc.api_base_path)}</td>"
            f"<td>{endpoint_examples}</td>"
            f"<td>{docs_link}</td>"
            f"<td>{openapi_link}</td>"
            f"<td>{compose_state}</td>"
            "</tr>"
        )

    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'/>"
        "<title>Teamder Swagger Index (Atomic First)</title>"
        "<style>"
        "body{font-family:Arial,sans-serif;padding:24px;background:#f5f7fb;color:#1f2937;}"
        "h1{margin:0 0 16px 0;} table{border-collapse:collapse;width:100%;background:white;}"
        "th,td{border:1px solid #d1d5db;padding:10px;text-align:left;} th{background:#eef2ff;}"
        "a{color:#2563eb;text-decoration:none;} a:hover{text-decoration:underline;}"
        ".meta{margin:0 0 14px 0;color:#4b5563;}"
        "</style></head><body>"
        "<h1>Teamder Swagger Docs Index (Atomic Services)</h1>"
        "<p class='meta'>"
        "Default scope is atomic. Available scopes: <a href='/docs-index?scope=atomic'>atomic</a>, "
        "<a href='/docs-index?scope=all'>all</a>, <a href='/docs-index?scope=composite'>composite</a>. "
        "JSON catalog: <a href='/docs-index.json?scope=atomic'>/docs-index.json?scope=atomic</a>. "
        "OpenAPI audit: <a href='/audit/openapi?scope=atomic'>/audit/openapi?scope=atomic</a>."
        "</p>"
        "<table><thead><tr>"
        "<th>Scope</th><th>Service</th><th>Host</th><th>API Base Path</th><th>Endpoints</th><th>Swagger UI</th><th>OpenAPI JSON</th><th>In Compose</th>"
        "</tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
        "</body></html>"
    )
    return Response(html, mimetype="text/html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4010")))
