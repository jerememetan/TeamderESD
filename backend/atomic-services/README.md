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

