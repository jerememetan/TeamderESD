# Teamder Backend

This file lists the local HTTP endpoints for the atomic and composite microservices (localhost).

Atomic services
- student-service: https://personal-0wtj3pne.outsystemscloud.com/Student/rest/Student/student/
- course-service: https://personal-0wtj3pne.outsystemscloud.com/Course/rest/Course/course/
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
- swap-constraints-service: http://localhost:3012 - /swap-constraints
- team-swap-service: http://localhost:3013 - /team-swap
- analytics-service: http://localhost:3014 - /analytics
- student-form-service: http://localhost:3015 - /student-form
- notification-service: http://localhost:3016 - /health, /notification/send-form-link, /notification/publish-email
- section-service: http://localhost:3018 - /section (GET/POST/PUT/DELETE), /section/{id}

Composite services
- formation-config-service: http://localhost:4000 - /formation-config (GET/POST)
- student-profile-service: http://localhost:4001 - /student-profile (GET)
- team-formation-service: http://localhost:4002 - /team-formation (GET; orchestrates student-form consumption and reputation updates before solve)
- dashboard-orchestrator-service: http://localhost:4003 - /dashboard, /dashboard/health
- formation-notification-service: http://localhost:4004 - /formation-notifications, /health
- swap-orchestrator-service: http://localhost:4005 - /swap-orchestrator/*

Swagger docs
- Per service:
  - Swagger UI: `http://localhost:<service-port>/docs`
  - OpenAPI JSON: `http://localhost:<service-port>/openapi.json`
- Central docs index: http://localhost:4010/docs-index
- Swagger exposure is config-gated with `ENABLE_SWAGGER` (enabled in local compose files by default).

RabbitMQ management UI: http://localhost:15672 (guest/guest)

Notes
- Ports are taken from `docker-compose.yaml` / `docker-compose.scenario1.yaml` mappings.
- Use the listed path fragments as example request URLs (e.g. `http://localhost:3001/api/students`).
