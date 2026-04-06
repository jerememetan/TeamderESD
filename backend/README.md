# Teamder Backend

This file lists the local HTTP endpoints for the atomic and composite microservices (localhost).

API gateway

- Kong gateway proxy: http://localhost:8000
- Kong admin API: http://localhost:8001
- Frontend/browser traffic should use Kong routes (for example `http://localhost:8000/team-formation`).
- CORS is now centralized at Kong; per-service Flask CORS middleware is removed.

Atomic services

- student-service: https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student/#/
- course-service: https://personal-0wtj3pne.outsystemscloud.com/Course/rest/Course/#/
- skill-service: http://localhost:3002 - /skill (GET/POST), /skill/{id}
- topic-service: http://localhost:3003 - /topic (GET/POST), /topic/{id}
- criteria-service: http://localhost:3004 - /criteria (GET/POST/PUT)
- enrollment-service: http://localhost:3005 - /enrollment
- reputation-service: http://localhost:3006 - /reputation (GET/POST), /reputation/{id} (GET/PUT)
- team-service: http://localhost:3007 - /team (GET/POST)
- student-competence-service: http://localhost:3008 - /competence
- student-topic-preference-service: http://localhost:3009 - /topic-preference
- student-form-data-service: http://localhost:3010 - /form-data
- swap-request-service: http://localhost:3011 - /swap-request
- team-swap-service: http://localhost:3013 - /team-swap
- peer-evaluation-service: http://localhost:3020 - /peer-eval
- student-form-service: http://localhost:3015 - /student-form
- notification-service: http://localhost:3016 - /health, /notification/send-form-link, /notification/publish-email
- section-service: http://localhost:3018 - /section (GET/POST/PUT/DELETE), /section/{id}
- error-service: http://localhost:3019 - /errors (GET, GET /errors/<id>, DELETE /errors/<id>)

Composite services

- formation-config-service: http://localhost:4000 - /formation-config (GET/POST)
- student-profile-service: http://localhost:4001 - /student-profile (GET)
- team-formation-service: http://localhost:4002 - /team-formation (POST; orchestrates student-form consumption and reputation updates before solve)
- dashboard-orchestrator-service: http://localhost:4003 - /dashboard, /dashboard/health
- formation-notification-service: http://localhost:4004 - /formation-notifications, /health
- swap-orchestrator-service: http://localhost:4005 - /swap-orchestrator/\*

Shared error logging

- Error service: http://localhost:3019 - /errors (GET, GET /errors/<id>, DELETE /errors/<id>)
- Composite services publish structured downstream failures to RabbitMQ using `ERROR_EXCHANGE_NAME`, `ERROR_EXCHANGE_TYPE`, and `ERROR_ROUTING_KEY_PREFIX`.
- The error service consumes `*.error` routing keys and stores the resulting log entries for the frontend error-log view.

Swagger docs

- Per service:
  - Swagger UI: `http://localhost:<service-port>/docs`
  - OpenAPI JSON: `http://localhost:<service-port>/openapi.json`
- Central docs index: http://localhost:4010/docs-index
- Swagger exposure is config-gated with `ENABLE_SWAGGER` (enabled in local compose files by default).

RabbitMQ management UI: http://localhost:15672 (guest/guest)

Architecture baseline and enforcement

- MSA baseline diagram: `backend/docs/msa-architecture.md`
- MSA student UI view: `backend/docs/msa-student-ui.md`
- MSA instructor UI view: `backend/docs/msa-instructor-ui.md`
- MSA swap functionality view: `backend/docs/msa-swap-functionality.md`
- Guardrail check script: `backend/scripts/check_architecture_guardrails.ps1`
- Run guardrails:
  - `cd backend`
  - `./scripts/check_architecture_guardrails.ps1`
- Current guardrails include:
  - no runtime `swap-constraints` references in compose/Kong
  - no cycle-era `/swap-orchestrator/cycles` route references in active app code
  - required instructor stage model keys: setup, collecting, forming, formed, confirmed, completed

Notes

- Ports are taken from `docker-compose.yaml` mappings.
- Use the listed path fragments as example request URLs (e.g. `http://localhost:8000/students`).
- For browser and frontend use, prefer the same paths via gateway base `http://localhost:8000`.
- Formation-notification now publishes one batch RabbitMQ message per section request to notification service; frontend request/response payloads are unchanged.
