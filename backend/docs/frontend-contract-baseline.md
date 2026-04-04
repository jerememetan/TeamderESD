# Frontend Contract Baseline (Phase 5)

## Purpose

This document defines the backend contract baseline for stabilized frontend pages.
Use this as the source of truth when refactoring high-coupling pages.

## Gateway Rule

- Frontend/browser traffic must go through Kong: `http://localhost:8000`.
- Service-to-service traffic can remain on internal ports.
- If a page bypasses Kong, consider it out-of-contract for frontend stabilization.

## Stable Service Baseline

Treat these as stable for frontend integration cleanup:

- `enrollment`
- `section`
- `team`
- `formation-config`
- `student-profile`
- `team-formation`
- `analytics`
- `peer-evaluation`

## Deferred / Risky Dependencies

Use only when a page explicitly requires them and contract is verified:

- `swap-orchestrator`: processed request contract is new and should be validated before broad use.
- `student-form` pipeline: known schema mismatch issue (`student_form` tables) still open.

## Per-Page Contract Notes (Stabilized Pages)

### Instructor Dashboard

- Frontend file: `frontend/src/pages/instructor/Dashboard/service/dashboardService.js`
- Endpoint: `GET /dashboard`
- Expected envelope: `{ code, data }`
- Required data keys: `totalCourses`, `totalGroups`, `totalStudents`, `pendingSwapRequests`

### Instructor CreateForm (Publish Links)

- Frontend file: `frontend/src/pages/instructor/CreateForm/service/notificationService.js`
- Endpoint: `POST /formation-notifications`
- Payload: section/course scoped request body from page flow
- Expected envelope: `{ code, data }` or `{ code, message }`

### Instructor Error Logs

- Frontend file: `frontend/src/services/errorLogService.js`
- Endpoints:
  - `GET /errors?page=&page_size=&status=&source_service=`
  - `DELETE /errors/{id}`
- Expected list envelope: `{ code, data: [] }`

### Instructor Completion Status

- Frontend files:
  - `frontend/src/pages/instructor/CompletionStatus/logic/useCompletionStatus.js`
  - `frontend/src/services/studentFormService.js`
- Endpoints:
  - `GET /courses/{code}`
  - `GET /section/{id}`
  - `GET /students`
  - `GET /student-form/submitted?section_id={id}`
  - `GET /student-form/unsubmitted?section_id={id}`
- Expected result: submitted + unsubmitted student rows mapped by backend student id.

### Student Peer Evaluation

- Frontend files:
  - `frontend/src/pages/student/PeerEvaluation/logic/usePeerEvaluationForm.js`
  - `frontend/src/services/peerEvaluationService.js`
- Endpoints:
  - `GET /peer-eval/rounds/{round_id}` (via Kong)
  - `GET /peer-eval/rounds/{round_id}/submissions?evaluator_id={id}` (via Kong)
  - `POST /peer-eval/rounds/{round_id}/submit` (via Kong)
  - `GET /team?section_id={id}`
  - `GET /students`
- Contract note: team membership uses backend numeric `student_id` and team identity uses `team_id`/`team_number`.

### Instructor Analytics

- Frontend files:
  - `frontend/src/pages/instructor/Analytics/logic/useAnalyticsPage.js`
  - `frontend/src/adapters/analyticsAdapter.js`
- Endpoints:
  - `GET /courses/{code}`
  - `GET /section/{id}`
  - `GET /team?section_id={id}`
  - `GET /enrollment?section_id={id}`
  - `GET /students`
- Contract note: adapter normalizes team score/name and group stats for charts.

### Instructor Courses

- Frontend files:
  - `frontend/src/pages/instructor/Courses/logic/useCoursesPage.js`
  - `frontend/src/adapters/courseAdapter.js`
- Endpoints:
  - `GET /courses`
  - `GET /section`
  - `GET /enrollment?section_ids={id1,id2,...}`
  - `GET /team?section_ids={id1,id2,...}`
  - `POST /team-formation` (section-based generation)
- Contract note: page computes stage/actions from normalized group contract and backend stage.

## Definition of Done Gate (Per Page)

A migrated page is considered done only if all checks pass:

1. Initial route render succeeds with no runtime crash.
2. Browser console has no page-specific errors.
3. Requests resolve through Kong paths where applicable.
4. Lint remains clean after changes.

## Change Discipline

- Keep migrations page-scoped to reduce rollback risk.
- Avoid endpoint shape assumptions in components; normalize in adapter/hook layers.
- Any new backend dependency must be documented here before broad reuse.
