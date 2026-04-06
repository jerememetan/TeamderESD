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
Returns the dashboard analytics envelope directly from the orchestrator.

### `data` payload

- `section_id`: section UUID used for the request
- `team_analytics`: normalized team metrics for charts and drill-downs
- `section_analytics`: section-level summary metrics
- `peer_eval_reputation`: peer review summary used by the instructor-facing reputation table
- `weight_recommendations`: peer review insights used by the instructor-facing "What Peer Reviews Suggest" module

### Peer review recommendation labels

- `INCREASE` means the evidence points toward increasing that weight.
- `NEEDS_INSTRUCTOR_REVIEW` means the pattern looks risky and should be reviewed before increasing that weight.
- `KEEP_OR_SLIGHTLY_REDUCE` means the evidence is weak or neutral, so the current weight is likely acceptable.

### Empty-state behavior

- If the section has no closed peer evaluation round, both peer-review blocks return a friendly empty state instead of failing the dashboard.
- If a round exists but no submissions were found, the dashboard still returns section analytics and marks the peer-review blocks as unavailable.
#### Error responses
- `400` — missing section_id
- `502` — upstream service failure, including formation-config unavailability

### GET /dashboard/health
Returns `{"status": "ok", "service": "dashboard-orchestrator-service"}`
