# Teamder Backend

This file lists the HTTP endpoints used during local development for atomic and composite microservices.

API gateway

- Kong gateway proxy: http://localhost:8000
- Kong admin API: http://localhost:8001
- Frontend/browser traffic should use Kong routes (for example `http://localhost:8000/team-formation`).
- CORS is now centralized at Kong; per-service Flask CORS middleware is removed.
- Kong caches GET responses for `students`, `courses`, `section`, and `enrollment` routes with the built-in `proxy-cache` plugin and a 5-minute TTL.
- Cache behavior is read-only: POST, PUT, PATCH, and DELETE requests are not cached.
- Query-string GETs for section and enrollment remain route-scoped through Kong and are cached as read requests.

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
- team-swap-service: http://localhost:3013 - /team-swap/execute (POST), /team-swap/sections/{section_id}/confirm (POST)
- peer-evaluation-service: http://localhost:3020 - /peer-eval
- student-form-service: http://localhost:3015 - /student-form
- notification-service: http://localhost:3016 - /health, /notification/send-form-link, /notification/publish-email
- section-service: http://localhost:3018 - /section (GET/POST/PUT/DELETE), /section/{id}
- error-service: http://localhost:3019 - /errors (GET, GET /errors/<id>, DELETE /errors/<id>)

Composite services

- formation-config-service: http://localhost:4000 - /formation-config (GET/POST)
- student-profile-service: http://localhost:4001 - /student-profile (GET)
- team-formation-service: http://localhost:4002 - /team-formation (POST), /teams (GET), /health
- dashboard-orchestrator-service: http://localhost:4003 - /dashboard (GET), /dashboard/health (GET)
- formation-notification-service: http://localhost:4004 - /formation-notifications (POST), /health (GET)
- swap-orchestrator-service: http://localhost:4005 - /swap-orchestrator/submission/requests (POST), /swap-orchestrator/review/requests (GET), /swap-orchestrator/review/requests/{swap_request_id}/decision (PATCH), /swap-orchestrator/sections/{section_id}/confirm (POST, deprecated proxy to team-swap), /swap-orchestrator/student-team (GET), /health (GET)
- student-form-submission-service: http://localhost:4006 - /student-form-submission/submit (POST)
- peer-eval-notification-service: http://localhost:4008 - /peer-eval-notifications/health (GET), /peer-eval-notifications/initiate (POST)
- peer-eval-close-service: http://localhost:4009 - /peer-eval-close (POST), /peer-eval-close/health (GET)

Shared error logging

- Error service: http://localhost:3019 - /errors (GET, GET /errors/<id>, DELETE /errors/<id>)
- Composite services publish structured downstream failures to RabbitMQ using `ERROR_EXCHANGE_NAME`, `ERROR_EXCHANGE_TYPE`, and `ERROR_ROUTING_KEY_PREFIX`.
- The error service consumes `*.error` routing keys and stores the resulting log entries for the frontend error-log view.
- Notification queues are configured with RabbitMQ dead-letter routing to `notification.topic` using `*.error` routing keys, so rejected notification messages are also stored by error-service.

Swagger docs

- Per service:
  - Swagger UI: `http://localhost:<service-port>/docs`
  - OpenAPI JSON: `http://localhost:<service-port>/openapi.json`
- Central docs index: http://localhost:4010/docs-index
- Central JSON index: http://localhost:4010/docs-index.json?scope=all
- Central OpenAPI audit: http://localhost:4010/audit/openapi?scope=all
- Scope filters: `scope=all`, `scope=atomic`, `scope=composite`
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
  - no cycle-era `/swap-orchestrator/cycles` route references in active app code
  - required instructor stage model keys: setup, collecting, forming, formed, confirmed, completed

Notes

- Ports are taken from `docker-compose.yaml` mappings.
- Use the listed path fragments as example request URLs (e.g. `http://localhost:8000/students`).
- For browser and frontend use, prefer the same paths via gateway base `http://localhost:8000`.
- Formation-notification now publishes one batch RabbitMQ message per section request to notification service; frontend request/response payloads are unchanged.
