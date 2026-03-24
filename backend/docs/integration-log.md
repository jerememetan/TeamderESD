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
- The page can trigger backend generation through `GET /team-formation?section_id=...`
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
