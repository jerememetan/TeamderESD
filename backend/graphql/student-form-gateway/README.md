# Student Form Gateway

UI-focused GraphQL gateway for Student Form pages.

This service composes data from existing REST microservices and returns a single GraphQL response tailored for frontend rendering.

## Purpose

- Keep atomic/composite REST services unchanged.
- Move frontend read orchestration into backend GraphQL composition.
- Return UI-ready form assignments and dynamic field definitions.

## Queries

### studentFormAssignments(studentId: ID!)

Returns student form entries composed with section/course metadata:

- id
- sectionId
- submitted
- title
- description

### studentFormPage(studentId: ID!, sectionId: ID!)

Returns one ready-to-render page payload:

- student context
- effective section
- field visibility derived from formation criteria weights
- skill/topic catalogs
- buddy options (when buddy criterion is enabled)

## Upstream dependencies

Configured via environment variables:

- STUDENT_FORM_URL
- FORMATION_CONFIG_URL
- ENROLLMENT_URL
- SECTION_URL
- COURSE_URL
- STUDENT_BULK_URL

## Local run (Docker Compose)

This service is wired in backend docker compose as:

- service name: student-form-gateway-service
- container name: teamder-student-form-gateway-service
- port: 4007
- Kong route: /graphql

From backend folder:

```bash
docker compose up --build
```

Then query through Kong:

- POST http://localhost:8000/graphql

## Notes

- Error publishing uses shared `error_publisher.py` conventions.
- GraphQL IDE support is enabled through environment config and Strawberry version compatibility handling.
