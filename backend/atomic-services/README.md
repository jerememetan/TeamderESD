
# Microservice API Documentation

This README provides simple instructions for calling the endpoints of the three atomic microservices: **criteria**, **project-topic**, and **skill**. All services are Flask-based and expose REST endpoints.

---

## Criteria Service
- **Base URL:** `/criteria` (default port: 3004)

### Endpoints
- **GET /criteria**
  - Query params: `section_id` (recommended), `course_id` (optional)
  - Returns: List of criteria filtered by section or course
  - Example:
    ```http
    GET http://localhost:3004/criteria?section_id={uuid}
    ```

- **GET /criteria/{section_id}**
  - Returns: Criteria for the given section_id
  - Example:
    ```http
    GET http://localhost:3004/criteria/{section_id}
    ```

- **POST /criteria**
  - Body: JSON matching `CriteriaCreateSchema` (must include `section_id` and `course_id`)
  - Example:
    ```json
    {
      "section_id": "...",
      "course_id": "...",
      "num_groups": ...,
      "school_weight": ...,
      "year_weight": ...,
      "gender_weight": ...,
      "gpa_weight": ...,
      "reputation_weight": ...,
      "mbti_weight": ...,
      "buddy_weight": ...,
      "topic_weight": ...,
      "skill_weight": ...,
      "randomness": ...
    }
    ```

---

## Project Topic Service
- **Base URL:** `/topic` (default port: 3003)

### Endpoints

- **GET /topic**
  - Query params: `section_id` (required)
  - Returns: List of topics filtered by section
  - Example:
    ```http
    GET http://localhost:3003/topic?section_id={uuid}
    ```

- **GET /topic/{topic_id}**
  - Returns: Topic with the given topic_id
  - Example:
    ```http
    GET http://localhost:3003/topic/{topic_id}
    ```


- **POST /topic**
  - Body: JSON matching `TopicCreateSchema` (must include `section_id` and `topic_label`)
  - Example:
    ```json
    {
      "section_id": "...",
      "topic_label": "..."
    }
    ```

---

## Skill Service
- **Base URL:** `/skill` (default port: 3002)

### Endpoints

- **GET /skill**
  - Query params: `section_id` (required)
  - Returns: List of skills filtered by section
  - Example:
    ```http
    GET http://localhost:3002/skill?section_id={uuid}
    ```

- **GET /skill/{skill_id}**
  - Returns: Skill with the given skill_id
  - Example:
    ```http
    GET http://localhost:3002/skill/{skill_id}
    ```


- **POST /skill**
  - Body: JSON matching `SkillCreateSchema` (must include `section_id`, `skill_label`, and optionally `skill_importance`)
  - Example:
    ```json
    {
      "section_id": "...",
      "skill_label": "...",
      "skill_importance": ...
    }
    ```

---

## Enrollment Service
- **Base URL:** `/enrollment` (default port: 3001)

### Endpoints

- **GET /enrollment**
  - Query params: `section_id` (optional)
  - Returns: List of enrollments, optionally filtered by section
  - Example:
    ```http
    GET http://localhost:3001/enrollment?section_id={uuid}
    ```

- **GET /enrollment**
  - Returns: All enrollments
  - Example:
    ```http
    GET http://localhost:3001/enrollment
    ```

---

## Reputation Service
- **Base URL:** `/reputation` (default port: 3001)

### Endpoints

- **GET /reputation**
  - Returns: List of all student reputations
  - Example:
    ```http
    GET http://localhost:3001/reputation
    ```

- **GET /reputation/{student_id}**
  - Returns: Reputation for the given student_id
  - Example:
    ```http
    GET http://localhost:3001/reputation/{student_id}
    ```

- **PUT /reputation/{student_id}**
  - Body: JSON with a `delta` integer (positive or negative) to increment/decrement the student's reputation score
  - Example:
    ```http
    PUT http://localhost:3001/reputation/{student_id}
    Content-Type: application/json
    {
      "delta": 5
    }
    ```
  - Response: Updated reputation object

## Team Service
- **Base URL:** `/team` (default port: 3007)

### Endpoints

- **GET /team?section_id={section_id}**
  - Query params: `section_id` (required)
  - Returns: All teams for the given section, grouped by section_id
  - Example:
    ```http
    GET http://localhost:3007/team?section_id=11111111-1111-1111-1111-111111111111
    ```
    **Response:**
    ```json
    {
      "code": 200,
      "data": {
        "section_id": "11111111-1111-1111-1111-111111111111",
        "teams": [
          {
            "team_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "team_number": 1,
            "students": [
              { "student_id": 101 },
              { "student_id": 102 }
            ]
          },
          ...
        ]
      }
    }
    ```

- **GET /team/{team_id}**
  - Returns: Team with the given team_id
  - Example:
    ```http
    GET http://localhost:3007/team/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
    ```
    **Response:**
    ```json
    {
      "code": 200,
      "data": {
        "team_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "team_number": 1,
        "students": [
          { "student_id": 101 },
          { "student_id": 102 }
        ]
      }
    }
    ```

- **POST /team**
  - Body: JSON with `section_id` and a `teams` array. Each team must have a `team_id` (UUID) and a list of `students` (each with `student_id`).
  - On POST, all existing teams for the section are deleted and replaced with the new teams.
  - Example:
    ```json
    {
      "section_id": "11111111-1111-1111-1111-111111111111",
      "teams": [
        {
          "team_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          "students": [
            { "student_id": 101 },
            { "student_id": 102 }
          ]
        },
        {
          "team_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          "students": [
            { "student_id": 103 },
            { "student_id": 104 }
          ]
        }
      ]
    }
    ```
    **Response:**
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
              { "student_id": 102 }
            ]
          },
          {
            "team_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "team_number": 2,
            "students": [
              { "student_id": 103 },
              { "student_id": 104 }
            ]
          }
        ]
      }
    }
    ```

## Student Competence Microservice

This microservice manages student competences (skills and levels) for sections. It is implemented in Flask and follows the structure of the skill atomic microservice.

### Endpoints

- `POST /competence/` — Bulk insert or update competences for a student in a section. Accepts a JSON object with `section_id`, `student_id`, and a `competences` array of objects with `skill_id` and `skill_level`.
- `GET /competence/` — Query competences by any combination of `skill_id`, `section_id`, `student_id` as query parameters.

### Example POST Body
```json
{
  "section_id": "11111111-1111-1111-1111-111111111111",
  "student_id": 101,
  "competences": [
    {
      "skill_id": "3b4e4a20-9e8a-4f5b-9d7b-1234567890ab",
      "skill_level": 3
    },
    {
      "skill_id": "3b4e4a20-9e8a-4f5b-9d7b-1234567890ac",
      "skill_level": 4
    }
  ]
}
```

---

## Student Topic Preference Microservice

This microservice manages student topic preferences for sections. It is implemented in Flask and follows the atomic microservice pattern.

### Endpoints

- **GET /topic-preference**
  - Query params: `section_id` (required), `student_id` (required)
  - Returns: Topic preferences for a student in a section
  - Example:
    ```http
    GET http://localhost:3006/topic-preference?section_id={uuid}&student_id={id}
    ```

- **POST /topic-preference**
  - Body: JSON matching `TopicPreferenceCreateSchema` (must include `section_id`, `student_id`, and a `preferences` array of topic IDs in ranked order)
  - On POST, previous preferences for the student in the section are replaced.
  - Example:
    ```json
    {
      "section_id": "11111111-1111-1111-1111-111111111111",
      "student_id": 101,
      "preferences": [
        "topic-uuid-1",
        "topic-uuid-2",
        "topic-uuid-3"
      ]
    }
    ```

---

## Student Form Data Microservice

This microservice manages student form data (buddy, MBTI, etc.) for a section. It is implemented in Flask and follows the atomic microservice pattern.

### Endpoints

- **GET /form-data**
  - Query params: `section_id` (required), `student_id` (required)
  - Returns: Form data for a student in a section
  - Example:
    ```http
    GET http://localhost:3008/form-data?section_id={uuid}&student_id={id}
    ```

- **POST /form-data**
  - Body: JSON matching `FormDataCreateSchema` (must include `section_id`, `student_id`, and optionally `buddy_id`, `mbti`)
  - On POST, previous form data for the student in the section is replaced.
  - Example:
    ```json
    {
      "section_id": "123e4567-e89b-12d3-a456-426614174000",
      "student_id": 42,
      "buddy_id": 99,
      "mbti": "INTJ"
    }
    ```

---

    ## Student Form Microservice

    This microservice manages the lightweight student-form rows (one-per-student-per-section). It exposes endpoints to create/update forms, query by section/student, and delete forms for a section.

    **Base URL:** `/student-form` (default port: 3015)

    ### Endpoints

    - **GET /student-form**
      - Query params: `section_id` (required), `student_id` (optional)
      - Behavior: If `student_id` is provided returns the single matching row for that student+section; otherwise returns all student-forms for the `section_id`.
      - Example:
        ```http
        GET http://localhost:3015/student-form?section_id={uuid}
        GET http://localhost:3015/student-form?section_id={uuid}&student_id=123
        ```

    - **GET /student-form/submitted**
      - Query params: `section_id` (required)
      - Returns: All student-forms for the section where `submitted=true`.
      - Example:
        ```http
        GET http://localhost:3015/student-form/submitted?section_id={uuid}
        ```

    - **GET /student-form/unsubmitted**
      - Query params: `section_id` (required)
      - Returns: All student-forms for the section where `submitted=false`.
      - Example:
        ```http
        GET http://localhost:3015/student-form/unsubmitted?section_id={uuid}
        ```

    - **POST /student-form**
      - Body: JSON matching `StudentFormCreateSchema` — must include `section_id` (UUID) and `students` (array of integer student IDs).
      - Behavior: Creates any missing `StudentForm` rows for the listed students in the section; existing rows are left unchanged.
      - Example request body:
        ```json
        {
          "section_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          "students": [123, 456, 789]
        }
        ```
      - Example success response: `200` (no new rows) or `201` (some rows created)
        ```json
        {
          "data": [
            { "id": 1, "student_id": 123, "section_id": "...", "submitted": false, "created_at": "...", "updated_at": "..." },
            { "id": 2, "student_id": 456, "section_id": "...", "submitted": false, "created_at": "...", "updated_at": "..." }
          ]
        }
        ```

    - **PUT /student-form**
      - Body: JSON matching `StudentFormUpdateSchema` — must include `student_id` (int) and `section_id` (UUID).
      - Behavior: Marks the matching student-form as `submitted=true` and returns the updated record.
      - Example request body:
        ```json
        {
          "student_id": 123,
          "section_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        }
        ```
      - Example response:
        ```json
        { "data": { "id": 1, "student_id": 123, "section_id": "...", "submitted": true, "created_at": "...", "updated_at": "..." } }
        ```

    - **DELETE /student-form**
      - Query params: `section_id` (required)
      - Behavior: Deletes all student-form rows for the given `section_id` and returns the deleted records in the response body.
      - Example call:
        ```http
        DELETE http://localhost:3015/student-form?section_id=3fa85f64-5717-4562-b3fc-2c963f66afa6
        ```
      - Example response:
        ```json
        {
          "data": [
            { "id": 1, "student_id": 123, "section_id": "...", "submitted": true, "created_at": "...", "updated_at": "..." },
            { "id": 2, "student_id": 456, "section_id": "...", "submitted": false, "created_at": "...", "updated_at": "..." }
          ]
        }
        ```

    ### Response & Error Format

    - Successful responses follow the pattern: `{ "data": ... }` where `data` is a single object or an array.
    - Validation errors return `400` with: `{ "error": { "code": "VALIDATION_ERROR", "message": <details> } }`.
    - Missing parameters return `400` with `MISSING_PARAMS` code.
    - Not found returns `404` with `NOT_FOUND` code.
    - Server errors return `500` with `SERVER_ERROR`.

    ### Notes

    - `section_id` must be a UUID string. `student_id` and entries in `students` must be integers.
    - The service uses the `student_form` table (schema `student_form`) and returns `created_at` / `updated_at` timestamps in ISO format.


## Swap Constraints Microservice

This microservice stores swap-appeal hard constraints per class/course/module scope.

### Endpoints

- **GET /swap-constraints**
  - Query params: `course_id` (optional), `module_id` (optional), `class_id` (optional)
  - Returns: Swap constraints filtered by the given scope values
  - Example:
    ```http
    GET http://localhost:3012/swap-constraints?course_id={uuid}&module_id={uuid}&class_id={uuid}
    ```

- **GET /swap-constraints/{constraint_id}**
  - Returns: One swap constraints record by its ID
  - Example:
    ```http
    GET http://localhost:3012/swap-constraints/{constraint_id}
    ```

- **POST /swap-constraints**
  - Body: JSON with `course_id`, `module_id`, `class_id`, and optional constraint values
  - Example:
    ```json
    {
      "course_id": "11111111-1111-1111-1111-111111111111",
      "module_id": "22222222-2222-2222-2222-222222222222",
      "class_id": "33333333-3333-3333-3333-333333333333",
      "min_team_avg_gpa": 3.0,
      "require_year_diversity": true,
      "max_skill_imbalance": 1.0,
      "swap_window_days": 2
    }
    ```

### Uniqueness Rule

Only one row is allowed per `course_id + module_id + class_id` combination.
If a duplicate combination is posted, the API returns `409 Conflict`.

---

## Team Swap Microservice

This microservice optimizes team swap selections using Google OR-Tools constraint solver.
It receives current teams, approved swap requests, swap constraints, and student attributes,
then finds the optimal subset of swaps that satisfy constraints while maximizing successful executions.

### Endpoint

- **POST /team-swap/optimize**
  - Body: Orchestrator payload with teams, approved requests, constraints, and student attributes
  - Returns: New team rosters and per-request execution status
  - Example request (basic):
    ```json
    {
      "section_id": "11111111-1111-1111-1111-111111111111",
      "course_id": "22222222-2222-2222-2222-222222222222",
      "module_id": "33333333-3333-3333-3333-333333333333",
      "class_id": "44444444-4444-4444-4444-444444444444",
      "teams": [
        {
          "team_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          "team_number": 1,
          "section_id": "11111111-1111-1111-1111-111111111111",
          "students": [101, 102]
        }
      ],
      "students": [
        {
          "student_id": 101,
          "year": 2,
          "gender": "M",
          "gpa": 3.5,
          "skills": {"skill-1": 0.8}
        },
        {
          "student_id": 102,
          "year": 1,
          "gender": "F",
          "gpa": 3.2,
          "skills": {"skill-1": 0.5}
        }
      ],
      "approved_swap_requests": [
        {
          "swap_request_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          "student_id": 101,
          "current_team": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        }
      ],
      "swap_constraints": {
        "min_team_avg_gpa": 3.0,
        "require_year_diversity": true,
        "max_skill_imbalance": 1.5,
        "swap_window_days": 2
      }
    }
    ```
  - Response includes `new_team_roster`, `per_request_result`, selected swap pairs, and solver metrics

### Algorithm Details

- Uses CP-SAT solver from Google OR-Tools for optimal swap selection
- Candidate generation: evaluates all pairwise swaps between students from different teams
- Feasibility check: year diversity, gender balance, skill imbalance, and minimum team GPA
- Optimization: maximizes number of successful swaps subject to one-student-per-swap and one-swap-per-team-pair constraints
- Fallback: requests not selected are marked FAILED with reason
