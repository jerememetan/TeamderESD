# Microservice Context: User Scenarios 1 and 2

## Scope

This document captures the current service interaction context for the first two user scenarios and the frontend contract assumptions used by the current implementation.

## Scenario 1 Status (Team Formation Core)

Status: Mostly stable in current frontend/backend integration pass.

Primary interaction chain:

1. Instructor configures criteria/skills/topics

- `POST /formation-config` (composite)
- Delegates to:
  - `criteria-service` (`/criteria`)
  - `skill-service` (`/skill`)
  - `topic-service` (`/topic`)

2. Instructor triggers team generation

- `POST /team-formation` (composite)
- Orchestrates:
  - `student-profile-service`
  - `formation-config-service`
  - `student-form-service`
  - `reputation-service`
  - `team-service`

3. Teams and roster views

- `GET /team`
- `GET /student-profile?section_id=...`
- `GET /enrollment?section_id=...`

## Scenario 2 Status (Instructor Views Team Dashboard)

Status: Contract exists and endpoint works for section-scoped analytics, but older UI placeholders caused mismatch. Analytics page now maps to the orchestrator payload.

Primary interaction chain:

1. Frontend calls section dashboard endpoint

- `GET /dashboard?section_id={section_uuid}`

2. Dashboard orchestrator gathers upstream data

- `GET /team?section_id=...`
- `GET /student-profile?section_id=...`
- `GET /criteria?section_id=...`
- `GET /skill?section_id=...`
- `GET /topic?section_id=...`

3. Dashboard orchestrator computes analytics

- `POST /analytics` with assembled team/student/profile/config payload

4. Frontend consumes response

- `data.team_analytics[]`
- `data.section_analytics`

## Verified Working Endpoint (Reference)

- `http://localhost:4003/dashboard?section_id=22222222-2222-2222-2222-222222222222`

Observed response summary:

- `code`: `200`
- `data.section_id`: `22222222-2222-2222-2222-222222222222`
- `data.team_analytics.length`: `5`
- `data.section_analytics.num_teams`: `5`
- `data.section_analytics.year_balance_score`: `0.8174`
- `data.section_analytics.school_balance_score`: `0.6898`
- `data.section_analytics.gender_balance_score`: `1.0`
- `data.section_analytics.buddy_satisfaction_overall.rate`: `0.75`

## Frontend Contract Notes (Current)

Analytics page currently expects:

1. Team-level metrics (`team_analytics[]`)

- `team_number`
- `gender_distribution`
- `year_distribution`
- `buddy_satisfaction.rate`

2. Section-level metrics (`section_analytics`)

- `year_balance_score`
- `school_balance_score`
- `gender_balance_score`
- `buddy_satisfaction_overall.rate`

These fields are now used for chart rendering instead of static placeholders.

## Open Risks

1. `/dashboard` without `section_id` still has a known 502 issue in the broader dashboard flow.
2. Scenario 2 depends on section-scoped dashboard endpoint and remains healthy based on current verification.
3. OutSystems-backed student/course fields may still need explicit canonical mapping doc if schema changes.

## Recommended Next Step

Create one canonical field dictionary for OutSystems and Supabase IDs (course, section, student, team) and keep it versioned in `backend/docs` to prevent silent schema drift.
