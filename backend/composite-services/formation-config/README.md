# Formation-Config Composite Service

This service orchestrates the creation and retrieval of team formation configuration data by aggregating and distributing data to the atomic microservices: criteria, project-topic, and skill.

---

## Base URL

- Default: `/` (port: 4000)

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
```
POST http://localhost:3010/
Content-Type: application/json
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
