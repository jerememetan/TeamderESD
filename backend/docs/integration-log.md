# Backend Integration Log

## 2026-03-24 :: Step 1 :: Create/Edit Group Form -> formation-config

### Goal

Replace the mock-driven instructor group form flow with the first real backend integration.

### Frontend scope

- Route: `/instructor/courses/:courseId/groups/:groupId/create-form`
- Page: `frontend/src/pages/instructor/`
- Service layer: `frontend/src/services/formationConfigService.js`
- ID bridge: `frontend/src/data/backendIds.js`

### Backend services touched

- Composite: `formation-config`
- Atomic services behind it: `criteria`, `project-topic`, `skill`

### Mapping decisions

- Frontend `groupId` maps to backend `section_id`
- Frontend `courseId` maps to backend `course_id`
- Because the current frontend mock IDs are not UUIDs, the frontend now uses an explicit mapping table in `frontend/src/data/backendIds.js`
- The current page now edits backend-native formation config instead of only a mock survey shape

### Payload mapping

- `preferredGroupSize` -> used to help derive `num_groups`
- `numGroups` -> `criteria.num_groups`
- `mixGender` -> gates `criteria.gender_weight`
- `mixYear` -> gates `criteria.year_weight`
- `allowBuddy` -> gates `criteria.buddy_weight`
- weight controls -> `criteria.*_weight` and `criteria.randomness`
- topic list -> `topics[]`
- skill list -> `skills[]`

### Current limitations

- The backend contract uses UUIDs, so the mapping table must be replaced with real backend IDs later
- `minimumGroupSize` is still a frontend-only planning field for now because `formation-config` does not currently store it
- `Save draft` and `Publish form` currently persist through the same backend endpoint; the distinction is presently UI-level because `formation-config` does not expose a publication status field
- If the backend is unavailable, the page falls back to derived mock defaults and shows an error banner instead of failing silently

### Next likely backend slice

- `student-profile` for real group roster data
- then `team-formation` for real generated teams per group

## 2026-03-24 :: Step 2 :: Instructor roster views -> student-profile

### Goal

Use the backend student-profile service to provide live section roster data in the instructor experience.

### Frontend scope

- Page: `frontend/src/pages/instructor/Teams.jsx`
- Page: `frontend/src/pages/instructor/Analytics.jsx`
- Service layer: `frontend/src/services/studentProfileService.js`
- Shared ID bridge reused from `frontend/src/data/backendIds.js`

### Backend services touched

- Composite: `student-profile`
- Downstream services behind it remain owned by the backend compose graph

### Mapping decisions

- Frontend `groupId` maps to backend `section_id`
- The instructor pages now fetch roster data per section using `GET /student-profile?section_id=...`
- Team assignments remain mock-backed for now because the current frontend team member IDs do not yet match backend `student_id` values

### UI behavior

- Instructor Teams shows a live section roster panel from student-profile
- Instructor Analytics uses live student-profile counts when available and falls back to frontend totals otherwise
- Both pages surface backend loading/failure state explicitly

### Current limitations

- The backend roster and the mock team assignments are displayed side-by-side, not merged yet
- A real merge should happen only after the `team`/`team-formation` integration establishes shared student identity across frontend and backend
- Student-facing pages still use mocked current-student context

### Next likely backend slice

- `team-formation`
- followed by `team` persistence and retrieval

## 2026-03-24 :: Step 3 :: Instructor team generation/view -> team-formation + team

### Goal

Allow the instructor teams page to load persisted backend teams and trigger backend team generation for a group.

### Frontend scope

- Page: `frontend/src/pages/instructor/Teams.jsx`
- Service layer: `frontend/src/services/teamFormationService.js`
- Service layer: `frontend/src/services/teamService.js`
- Shared ID bridge reused from `frontend/src/data/backendIds.js`

### Backend services touched

- Composite: `team-formation`
- Atomic: `team`

### Mapping decisions

- Frontend `groupId` maps to backend `section_id`
- The frontend team page first requests persisted teams from `GET /team?section_id=...`
- The page can trigger backend generation through `POST /team-formation` with JSON body `{ "section_id": "..." }`
- Numeric backend `student_id` memberships are enriched on the frontend using the already-fetched `student-profile` roster

### UI behavior

- If backend teams exist, the page renders backend-generated teams
- If backend teams do not exist yet, the page falls back to mock teams and shows a generate action
- Generating teams persists them through the backend and swaps the page to the backend dataset immediately

### Current limitations

- Backend teams do not currently expose confirmation state, team score, or richer analytics fields
- Swap request wiring is still mock-backed and only applies cleanly to the mock team dataset for now
- Team naming currently falls back to frontend numbering when `team_number` is absent in backend responses

### Next likely backend slice

- align analytics with backend team outputs
- then move student-facing team views off mock data

## 2026-03-24 :: Step 4 :: Student team summary/view -> team + student-profile

### Goal

Use backend team memberships and live roster data in the student dashboard and My Team flow.

### Frontend scope

- Page: `frontend/src/pages/student/MyTeam.jsx`
- Page: `frontend/src/pages/student/StudentDashboard.jsx`
- Service layer: `frontend/src/services/studentAssignmentService.js`
- Shared ID bridge extended in `frontend/src/data/backendIds.js`

### Backend services touched

- Atomic: `team`
- Composite: `student-profile`

### Mapping decisions

- A temporary `currentStudent` -> backend `student_id` mapping is used because real authentication is not integrated yet
- Student assignments are built by finding backend teams that contain that mapped backend student ID
- Backend team memberships are enriched with `student-profile` roster details to render names and emails

### UI behavior

- Student pages use backend assignments when available
- If backend assignments are not available yet, the pages fall back to the existing mock team data
- The UI surfaces whether data is coming from backend assignments or mock fallback

### Current limitations

- The current student identity is still a frontend-only mapping used for testing
- Student confirmation state remains mock-level when backend teams are shown because that service has not been integrated yet
- Because some group mappings are temporarily reused for testing, backend assignment coverage may not match the final course/group model yet

### Next likely backend slice

- real student/session identity mapping
- then swap-request workflow on top of backend teams

## Student-form backend bug note

- The new student-form-service currently depends on a separate student_form schema with form_template, form_submission, and form_link tables.
- In the current Supabase setup, only student_form_data.form_data exists, so requests into student-form-service fail at runtime.
- This affects publish-form flow through formation-notification and can also produce repeated backend errors whenever composite services query student-form endpoints.
- Treat this as an open backend provisioning bug until the student_form schema/tables are created or the service is remapped.

## Historical note

- Detailed cycle-era swap orchestration notes (Steps 6 to 8) were removed from this active log during endgame cleanup.
- Current runtime swap contract is Step 9 onward (`submission/review/decision/confirm/student-team`).

## 2026-04-05 :: Step 9 :: Swap constraints decommission + cycle-free swap routing

### Goal

Complete the move away from cycle-era swap orchestration and remove the no-longer-used swap-constraints service from runtime routing and local compose.

### Infrastructure scope

- Removed `swap-constraints-service` from `docker-compose.yaml`.
- Removed `/swap-constraints` route from Kong declarative config.
- Removed `swap-constraints-service` from docs index service list.

### Runtime contract now in use

- `POST /swap-orchestrator/submission/requests`
- `GET /swap-orchestrator/review/requests`
- `PATCH /swap-orchestrator/review/requests/{swap_request_id}/decision`
- `POST /swap-orchestrator/sections/{section_id}/confirm`
- `GET /swap-orchestrator/student-team`

### Notes

- CORS remains centralized at Kong and applies to swap-orchestrator routes through the global plugin.
- Existing cycle-based documentation entries are historical and should be treated as superseded by the cycle-free routes above.

## 2026-04-05 :: Step 10 :: Confirm-path hotfix + verification gate pass

### Goal

Resolve the Phase 6 blocker where `POST /swap-orchestrator/sections/{section_id}/confirm` returned `502` due upstream section-service failures.

### Root cause

- section-service rows contained stage value `confirmed`.
- Python SQLAlchemy enum in section-service model did not include `confirmed`.
- Any section row fetch by ID raised enum deserialization `LookupError`, surfaced as section-service `500`, then swap-orchestrator `502`.

### Fix implemented

- Updated section-service model enum to include `confirmed`:
  - `backend/atomic-services/section/section/models/section_model.py`
- Rebuilt and restarted `section-service`, `swap-orchestrator-service`, and `kong-gateway`.

### Verification evidence

- `GET /section/{section_id}` now returns `200` with stage `confirmed`.
- `POST /swap-orchestrator/sections/{section_id}/confirm` now returns `200`.
- Full scripted verification now passes lifecycle assertions:
  - `backend/scripts/verify_swap_flow.ps1`
  - submissions: `201`
  - decisions: approve/reject `200`, rejected re-approve `409` (expected terminal behavior)
  - confirm: `200`
  - final statuses: approved -> `executed`, rejected -> `rejected`
  - section stage after confirm: `confirmed`
  - non-requested participants unchanged: `true`

## 2026-04-06 :: Step 11 :: Frontend lint cleanup + docs status sync

### Goal

Close remaining frontend lint debt noted during swap migration and align planning docs with current state.

### Work completed

- Updated student fill-form hook dependency handling in:
  - `frontend/src/pages/student/FillForm/logic/useFillFormPage.js`
- Frontend diagnostics now report no active problems for the workspace.
- Performed a targeted frontend/docs sweep for stale cycle-route usage in active swap pages/services; no active cycle-route references were found in current frontend swap service paths.

### Documentation updates

- Updated `backend/docs/plan.md` to mark Phase 7 cleanup as done.
- Removed outdated note claiming unresolved frontend lint warnings.

## 2026-04-06 :: Step 12 :: MSA diagram persisted + architecture guardrails enforced

### Goal

Persist the target microservice architecture as a repo artifact and make core migration rules enforceable.

### Work completed

- Added architecture baseline diagram:
  - `backend/docs/msa-architecture.md`
- Added architecture guardrail script:
  - `backend/scripts/check_architecture_guardrails.ps1`
- Linked guardrails in backend ops docs:
  - `backend/README.md`

### Guardrails currently enforced

- No `swap-constraints` references in active runtime config (`docker-compose.yaml`, `kong/kong.yml`).
- No cycle-era swap routes (`/swap-orchestrator/cycles`, `/cycles/`) in active app code roots.
- Instructor stage model mapping contains:
  - setup, collecting, forming, formed, confirmed, completed

## 2026-04-06 :: Step 13 :: Split MSA into 3 diagram views

### Goal

Provide separate architecture views for clearer stakeholder validation.

### Added diagrams

- Student UI view:
  - `backend/docs/msa-student-ui.md`
- Instructor UI view:
  - `backend/docs/msa-instructor-ui.md`
- Swap functionality view:
  - `backend/docs/msa-swap-functionality.md`

### Documentation wiring

- Added cross-links from `backend/docs/msa-architecture.md`.
- Added all three diagram entries to `backend/README.md` architecture section.

## 2026-04-06 :: Step 14 :: Runtime policy alignment to MSA diagrams (strict)

### Goal

Align swap runtime behavior 100% with approved flow diagrams, especially appeal/confirm stage rules.

### Enforcements added

- `swap-orchestrator` decision endpoint now blocks in-app appeal when section stage is `confirmed` or `completed`.
- `swap-orchestrator` confirm endpoint now requires section stage to be exactly `formed`.

### Guardrail script updates

- `backend/scripts/check_architecture_guardrails.ps1` now verifies:
  - no-appeal guard exists for `confirmed`/`completed`
  - confirm flow contains formed-only stage guard
