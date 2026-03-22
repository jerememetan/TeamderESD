# Formation-Config Composite Service

This service orchestrates the creation and retrieval of team formation configuration data by aggregating and distributing data to the atomic microservices: criteria, project-topic, and skill.

---

## Base URL

- Default: `/formation-config` (port: 4000)

---

## POST /

Aggregate and distribute formation data to atomic services.

### Input JSON Body
```
{
  "course_id": "<uuid>",
  "section_id": "<uuid>",
  "criteria": { ... },
  "topics": [ ... ],
  "skills": [ ... ]
}
```

- `course_id` (required): UUID for the course (used only for criteria)
- `section_id` (required): UUID for the section
- `criteria` (required): Object matching the criteria schema (must include all required weights and group info)
- `topics` (optional): Array of topic objects `{ "topic_label": "..." }`
- `skills` (optional): Array of skill objects `{ "skill_label": "...", "skill_importance": <float> }`

#### Example
```json
{
  "course_id": "11111111-1111-1111-1111-111111111111",
  "section_id": "22222222-2222-2222-2222-222222222211",
  "criteria": {
    "num_groups": 3,
    "school_weight": 1.0,
    "year_weight": 1.0,
    "gender_weight": 1.0,
    "gpa_weight": 1.0,
    "reputation_weight": 1.0,
    "mbti_weight": 1.0,
    "buddy_weight": 1.0,
    "topic_weight": 1.0,
    "skill_weight": 1.0,
    "randomness": 0.5
  },
  "topics": [
    { "topic_label": "AI" },
    { "topic_label": "Web" }
  ],
  "skills": [
    { "skill_label": "Python", "skill_importance": 0.2 },
    { "skill_label": "React", "skill_importance": 0.3 }
  ]
}
```

### Output
```
{
  "criteria": { ... },
  "topics": [ ... ],
  "skills": [ ... ]
}
```
- Each key contains the response from the respective atomic service after creation/update.

---

## GET /

Aggregate and retrieve formation data from atomic services for a given section.

### Query Parameters
- `section_id` (required): UUID for the section

#### Example
```
GET http://localhost:3010/?section_id=22222222-2222-2222-2222-222222222211
```

### Output
```
{
  "course_id": "11111111-1111-1111-1111-111111111111",
  "section_id": "22222222-2222-2222-2222-222222222211",
  "criteria": { ... },
  "topics": [ ... ],
  "skills": [ ... ]
}
```
- `course_id` is extracted from the criteria record.
- `criteria` is the criteria object for the section.
- `topics` is an array of topic objects for the section.
- `skills` is an array of skill objects for the section.

---

## Notes
- All requests and responses use JSON.
- Errors are returned as `{ "error": "..." }` with appropriate HTTP status codes.
- The service expects the atomic services to be running and reachable at their configured URLs.

---

# Student Profile Composite Service

This service aggregates student-level data needed for team formation in one API call.

## Base URL

- Default: `/student-profile` (port: 4001)

## GET /student-profile

Returns student profiles for all students enrolled in a given section.

### Query Parameters
- `section_id` (required): UUID for the section

### Example
```http
GET http://localhost:4001/student-profile?section_id=11111111-1111-1111-1111-111111111111
```

### Success Response (200)
```json
{
  "code": 200,
  "data": {
    "section_id": "11111111-1111-1111-1111-111111111111",
    "students": [
      {
        "student_id": 101,
        "profile": {
          "name": "Alice Tan",
          "email": "alice.tan.2023@smu.edu.sg",
          "school": "SCIS",
          "year": 2,
          "gpa": 3.6,
          "gender": "F",
          "buddy_id": 102,
          "mbti": "INTJ",
          "reputation_score": 12,
          "topic_preferences": [
            "topic-uuid-1",
            "topic-uuid-2",
            "topic-uuid-3"
          ],
          "competences": [
            {
              "skill_id": "3b4e4a20-9e8a-4f5b-9d7b-1234567890ab",
              "skill_level": 3
            }
          ]
        }
      }
    ]
  }
}

```

### Validation Error (400)
```json
{
  "code": 400,
  "message": "section_id is required"
}
```

### Behavior Notes
- If no enrollments exist for the section, returns `200` with `students: []`.
- Enrollment fetch failure or OutSystems profile fetch failure returns a `5xx` error.
- Profile lookup is done directly against OutSystems endpoint (`GET {OUTSYSTEMS_BASE_URL}/student/`) and filtered by enrolled IDs.
- For non-fatal downstream failures, the request still returns `200` and only the affected profile field(s) are `null`.
- Response excludes `enrollment` and keeps only `student_id` at the top level; aggregated fields are nested inside `profile`.

---

# Team Formation Composite Service

This service orchestrates team generation and persistence by:

1. Fetching student data from `student-profile` composite microservice.
2. Fetching criteria/topics/skills from `formation-config` composite microservice.
3. Solving team assignment with OR-Tools CP-SAT.
4. Posting generated teams into the team atomic microservice (`POST /team`).
5. Returning the response from the team atomic microservice.

## Base URL

- Default: `/team-formation` (port: 4002)
- Container service name: `team-formation-service`

## Endpoints

### GET /health

Simple health endpoint.

#### Success Response (200)
```json
{
  "status": "ok",
  "service": "team-formation-service"
}
```

### GET /team-formation

Generates teams for a section, persists them to team atomic service, and returns the team service response.

### Query Parameters
- `section_id` (required): UUID for the section

### Headers
- `X-Debug-Mode` (optional): Truthy values `true|1|yes|on`. This affects failure payload only (`422`) by including solver metadata in `data`.

### Example
```http
GET http://localhost:4002/team-formation?section_id=11111111-1111-1111-1111-111111111111
```

### Success Response (typically 201)

The service returns the body/status from `POST /team` of the team atomic service.

```json
{
  "code": 201,
  "data": {
    "section_id": "11111111-1111-1111-1111-111111111111",
    "teams": [
      {
        "team_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "team_number": 1,
        "students": [
          { "student_id": 101 },
          { "student_id": 102 },
          { "student_id": 103 }
        ]
      }
    ]
  }
}
```

### Validation Error (400)
```json
{
  "code": 400,
  "message": "section_id is required"
}
```

### Downstream Error (502)
```json
{
  "code": 502,
  "message": "failed to fetch student profile"
}
```

### Persistence Error (502)
```json
{
  "code": 502,
  "message": "failed to persist teams"
}
```

### Solver Failure (422)
```json
{
  "code": 422,
  "message": "team formation could not be generated"
}
```

### Solver Failure with Debug Header (422)
```json
{
  "code": 422,
  "message": "team formation could not be generated",
  "data": {
    "section_id": "11111111-1111-1111-1111-111111111111",
    "teams": [],
    "status": "INFEASIBLE",
    "num_groups": 5,
    "objective": {},
    "solver_stats": {},
    "diagnostics": {}
  }
}
```

## Internal REST Calls

### Inputs consumed by team-formation composite
- `GET {STUDENT_PROFILE_URL}?section_id=<uuid>`
- `GET {FORMATION_CONFIG_URL}?section_id=<uuid>`

### Output produced by team-formation composite
- `POST {TEAM_URL}` with body:
```json
{
  "section_id": "11111111-1111-1111-1111-111111111111",
  "teams": [
    {
      "team_id": "generated-uuid",
      "students": [
        { "student_id": 101 },
        { "student_id": 102 }
      ]
    }
  ]
}
```

## Environment Variables

- `PORT` (default: `4002`)
- `REQUEST_TIMEOUT` (default: `8`)
- `STUDENT_PROFILE_URL` (default: `http://localhost:4001/student-profile`)
- `FORMATION_CONFIG_URL` (default: `http://localhost:4000/formation-config`)
- `TEAM_URL` (default: `http://localhost:3007/team`)
- `SOLVER_TIME_LIMIT_S` (default: `10`)
- `LOG_LEVEL` (default: `INFO`)

## Team-Formation Service Structure

```text
team-formation/
  Dockerfile
  requirements.txt
  team-formation/
    app.py                  # Flask routes + orchestration + persistence call to /team
    solver.py               # two-phase CP-SAT solve + response shaping
    config_interpreter.py   # criteria parsing, scaling, solver runtime parameters
    data_preparation.py     # payload validation/normalization and feature extraction
    objective_builder.py    # deterministic objective construction per criterion
    randomness_engine.py    # assignment jitter objective for controlled randomness
    solver_models.py        # dataclasses for typed solver inputs/prepared data
    test_app.py
    test-cases/
```
