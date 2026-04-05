import os

from flask import Flask, Response


app = Flask(__name__)


SERVICES = [
    ("student-service", "http://localhost:8000/students"),
    ("skill-service", "http://localhost:3002"),
    ("topic-service", "http://localhost:3003"),
    ("criteria-service", "http://localhost:3004"),
    ("enrollment-service", "http://localhost:3005"),
    ("reputation-service", "http://localhost:3006"),
    ("team-service", "http://localhost:3007"),
    ("student-competence-service", "http://localhost:3008"),
    ("student-topic-preference-service", "http://localhost:3009"),
    ("student-form-data-service", "http://localhost:3010"),
    ("swap-request-service", "http://localhost:3011"),
    ("team-swap-service", "http://localhost:3013"),
    ("student-form-service", "http://localhost:3015"),
    ("notification-service", "http://localhost:3016"),
    ("course-service", "http://localhost:8000/courses"),
    ("section-service", "http://localhost:3018"),
    ("formation-config-service", "http://localhost:4000"),
    ("student-profile-service", "http://localhost:4001"),
    ("team-formation-service", "http://localhost:4002"),
    ("dashboard-orchestrator-service", "http://localhost:4003"),
    ("formation-notification-service", "http://localhost:4004"),
    ("swap-orchestrator-service", "http://localhost:4005"),
]


@app.get("/health")
def health():
    return {"status": "ok", "service": "swagger-index-service"}


@app.get("/")
@app.get("/docs-index")
def docs_index():
    rows = []
    for name, base_url in SERVICES:
        rows.append(
            "<tr>"
            f"<td>{name}</td>"
            f"<td><a href='{base_url}' target='_blank'>{base_url}</a></td>"
            f"<td><a href='{base_url}/docs' target='_blank'>/docs</a></td>"
            f"<td><a href='{base_url}/openapi.json' target='_blank'>/openapi.json</a></td>"
            "</tr>"
        )

    html = (
        "<!DOCTYPE html><html><head><meta charset='utf-8'/>"
        "<title>Teamder Swagger Index</title>"
        "<style>"
        "body{font-family:Arial,sans-serif;padding:24px;background:#f5f7fb;color:#1f2937;}"
        "h1{margin:0 0 16px 0;} table{border-collapse:collapse;width:100%;background:white;}"
        "th,td{border:1px solid #d1d5db;padding:10px;text-align:left;} th{background:#eef2ff;}"
        "a{color:#2563eb;text-decoration:none;} a:hover{text-decoration:underline;}"
        "</style></head><body>"
        "<h1>Teamder Swagger Docs Index</h1>"
        "<p>Use this page to open each service Swagger UI and OpenAPI spec.</p>"
        "<table><thead><tr><th>Service</th><th>Base URL</th><th>Swagger UI</th><th>OpenAPI JSON</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
        "</body></html>"
    )
    return Response(html, mimetype="text/html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "4010")))
