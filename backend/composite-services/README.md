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
