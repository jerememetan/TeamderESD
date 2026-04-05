## Dashboard Orchestrator (Composite)
- **Port:** 4003
- **Base URL:** `/dashboard`
- **Purpose:** Orchestrates data gathering and computes dashboard analytics locally.

### GET /dashboard?section_id={uuid}

Fetches team and student data, reads criteria/skills/topics from the formation-config
composite service, computes analytics inside the orchestrator, and returns the result.

#### Upstream calls:
1. `GET /team?section_id=...` (Team Service, port 3007)
2. `GET /student-profile?section_id=...` (Student Profile, port 4001)
3. `GET /formation-config?section_id=...` (Formation Config Composite, port 4000)

#### Response
Returns the dashboard analytics envelope directly from the orchestrator.

#### Error responses
- `400` — missing section_id
- `502` — upstream service failure, including formation-config unavailability

### GET /dashboard/health
Returns `{"status": "ok", "service": "dashboard-orchestrator-service"}`
