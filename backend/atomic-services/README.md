# Microservice API Documentation

This README provides simple instructions for calling the endpoints of the three atomic microservices: **criteria**, **project-topic**, and **skill**. All services are Flask-based and expose REST endpoints.

---

## Criteria Service
- **Base URL:** `/criteria` (default port: 3004)

### Endpoints
- **GET /criteria**
  - Query params: `course_id` (optional)
  - Returns: List of criteria filtered by course
  - Example:
    ```http
    GET http://localhost:3004/criteria?course_id={uuid}
    ```

- **POST /criteria**
  - Body: JSON matching `CriteriaCreateSchema`
  - Example:
    ```http
    POST http://localhost:3004/criteria
    Content-Type: application/json
    {
      "course_id": "...",
      "num_groups": ...,
      "school_weight": ...,
      "year_weight": ...,
      "gender_weight": ...,
      "gpa_weight": ...
    }
    ```

---

## Project Topic Service
- **Base URL:** `/topics` (default port: 3002)

### Endpoints
- **GET /topics**
  - Query param: `course_id` (optional)
  - Returns: List of topics filtered by course
  - Example:
    ```http
    GET http://localhost:3002/topics?course_id={uuid}
    ```

- **POST /topics**
  - Body: JSON matching `TopicCreateSchema`
  - Example:
    ```http
    POST http://localhost:3002/topics
    Content-Type: application/json
    {
      "course_id": "...",
      "topic_label": "..."
    }
    ```

---

## Skill Service
- **Base URL:** `/skills` (default port: 3001)

### Endpoints
- **GET /skills**
  - Query param: `course_id` (optional)
  - Returns: List of skills filtered by course
  - Example:
    ```http
    GET http://localhost:3001/skills?course_id={uuid}
    ```

- **POST /skills**
  - Body: JSON matching `SkillCreateSchema`
  - Example:
    ```http
    POST http://localhost:3001/skills
    Content-Type: application/json
    {
      "course_id": "...",
      "skill_label": "...",
      "skill_importance": ...
    }
    ```

---

