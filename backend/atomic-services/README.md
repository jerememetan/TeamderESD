
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
    ```http
    POST http://localhost:3004/criteria
    Content-Type: application/json
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
    ```http
    POST http://localhost:3003/topic
    Content-Type: application/json
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
    ```http
    POST http://localhost:3002/skill
    Content-Type: application/json
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
    ```http
    POST http://localhost:3007/team
    Content-Type: application/json
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
