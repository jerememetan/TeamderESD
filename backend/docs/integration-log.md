# Backend Integration Log

## 2026-03-24 :: Step 1 :: Create/Edit Group Form -> formation-config

### Goal
Replace the mock-driven instructor group form flow with the first real backend integration.

### Frontend scope
- Route: `/instructor/courses/:courseId/groups/:groupId/create-form`
- Page: `frontend/src/pages/instructor/CreateForm.jsx`
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
