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

## Final Frontend Cleanup Note

Before final delivery, remove or soften temporary integration diagnostics from user-facing UI, including labels such as:

- Backend assignments loaded
- Mock assignments active
- Backend team membership loaded
- From backend team
- other backend/mock source indicators used only for testing and transition

Replace them with normal user-facing copy once backend integration is fully complete and fallback/testing states are no longer needed.

## 2026-03-24 :: Step 5 :: Mock peer evaluation flow

### Goal

Add an end-of-project peer evaluation experience to the frontend before the backend reputation workflow is integrated.

### Frontend scope

- Page: rontend/src/pages/instructor/Teams.jsx
- Page: rontend/src/pages/student/StudentDashboard.jsx
- Page: rontend/src/pages/student/PeerEvaluationForm.jsx
- Service layer: rontend/src/services/peerEvaluationService.js
- Mock seed data/types: rontend/src/data/mockData.ts, rontend/src/types/index.ts

### Behavior

- Instructors can start a peer evaluation round for a specific course group from the group teams page
- Students see pending peer evaluation work on their dashboard
- Students can rate every teammate and themselves from 1 to 5 and give a short written justification for each rating
- Submissions create a private reputation signal in the mock service, but that value is intentionally not shown in the student UI

### Current limitations

- This slice is frontend-only and in-memory for now; refreshing clears the round/submission state
- Instructor initiation currently lives on the group teams page rather than a dedicated course matrix control
- Reputation impact is stored only as a mock private signal until the real backend reputation flow is integrated

### Next likely backend slice

- swap-request workflow on top of backend teams
- later reputation / peer evaluation persistence if those services are added

## Student-form backend bug note

- The new student-form-service currently depends on a separate student_form schema with orm_template, orm_submission, and orm_link tables.
- In the current Supabase setup, only student_form_data.form_data exists, so requests into student-form-service fail at runtime.
- This affects publish-form flow through ormation-notification and can also produce repeated backend errors whenever composite services query student-form endpoints.
- Treat this as an open backend provisioning bug until the student_form schema/tables are created or the service is remapped.

## 2026-04-04 :: Step 6 :: Processed swap requests -> swap-orchestrator

### Goal

Move instructor-facing swap request shaping out of the atomic swap-request service and into swap-orchestrator so frontend consumers can use a processed contract with complete display values.

### Backend scope

- Composite: `swap-orchestrator`
- New endpoint: `GET /swap-orchestrator/cycles/:cycle_id/requests/processed`

### Contract

- Response envelope remains `{ code, data }`.
- `data.requests` returns processed rows with keys:
  - `id`, `courseId`, `courseName`, `studentId`, `studentName`, `currentTeamId`, `currentTeamName`, `groupId`, `reason`, `status`, `createdAt`
- `status` is normalized to lowercase.

### Enrichment behavior

- Base records come from cycle request mappings + atomic swap-request reads.
- Student names are enriched through student-service bulk lookup.
- Team names are enriched through section team lookup (`Team <team_number>`).
- Course name is resolved through course-service where possible.
- Deterministic fallbacks are used so display fields are never null.

### Compatibility

- Existing `GET /swap-orchestrator/cycles/:cycle_id/requests` remains unchanged.
- Atomic `swap-request` endpoints remain storage-focused and unchanged.

## 2026-04-05 :: Step 7 :: Backend dependency hardening baseline (Phase 5 support track)

### Goal

Establish a stable backend contract baseline for page-by-page frontend recovery, and explicitly mark risky dependencies that should be deferred unless required.

### Scope

- Documentation-only support track (no service behavior changes).
- Frontend pages stabilized in earlier phases are mapped to concrete backend endpoints and envelopes.
- Kong gateway usage is reaffirmed as the browser entrypoint.

### New artifact

- `backend/docs/frontend-contract-baseline.md`

### Baseline decisions

- Stable baseline services for frontend cleanup:
  - `enrollment`, `section`, `team`, `formation-config`, `student-profile`, `team-formation`, `analytics`, `peer-evaluation`
- Deferred/high-risk dependencies:
  - `swap-orchestrator` (validate processed contract before broad adoption)
  - `student-form` pipeline (known schema mismatch issue remains open)

### Contract coverage summary

- Instructor Dashboard: `GET /dashboard`
- CreateForm notifications: `POST /formation-notifications`
- Error Logs: `GET /errors`, `DELETE /errors/{id}`
- Completion Status: course/section/students + submitted/unsubmitted student-form endpoints
- Student Peer Evaluation: peer-eval round/submission/submit + team + students
- Instructor Analytics: courses/section/team/enrollment/students
- Instructor Courses: courses/section + batched enrollment/team + team-formation trigger

### Operational rule

- Browser/frontend requests should route through Kong (`http://localhost:8000`) during stabilization unless a service is explicitly exempted.

### Why this matters

- Reduces integration churn by documenting known-good dependencies.
- Prevents component-level schema drift by forcing adapter/hook normalization first.
- Supports safer rollback with page-scoped migrations and explicit contracts.

## 2026-04-05 :: Step 8 :: Phase 6 verification gate run

### Goal

Run verification checks for stabilized pages and Kong-backed contracts before continuing migrations.

### Checks executed

  - `GET /peer-eval/rounds...` -> pass (200)
  - `GET /errors`, `GET /courses`, `GET /section`, `GET /team`, `GET /enrollment` -> pass
  - `GET /student-form/submitted`, `GET /student-form/unsubmitted` -> pass
  - `GET /dashboard/health` -> pass

### Gateway alignment updates performed


### Blocker found


### Gate status

### Artifact
