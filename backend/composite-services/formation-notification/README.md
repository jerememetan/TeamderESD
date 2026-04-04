# Formation Notification Composite Service

This service orchestrates form-link notification publishing for all students enrolled in a section.

## Base URL

- Default: `/formation-notifications` (port: `4004`)

## POST /formation-notifications

Publishes notification messages with form links for all enrolled students in the provided section.

### Input JSON Body
```json
{
  "section_id": "IS213-2026-01"
}
```

- `section_id` (required): non-empty section identifier.

### Example
```http
POST http://localhost:4004/formation-notifications
Content-Type: application/json

{
  "section_id": "IS213-2026-01"
}
```

### Success Response (201)
```json
{
  "section_id": "IS213-2026-01",
  "notifications_created": [
    {
      "student_id": 101,
      "email": "student1@university.edu",
      "form_id": "f-001",
      "form_link": "http://localhost:5173/student/101/form/f-001"
    }
  ],
  "notifications_failed": [],
  "summary": {
    "total_students": 1,
    "success_count": 1,
    "failed_count": 0
  }
}
```

### Partial Success Response (207)
```json
{
  "section_id": "IS213-2026-01",
  "notifications_created": [
    {
      "student_id": 101,
      "email": "student1@university.edu",
      "form_id": "f-001",
      "form_link": "http://localhost:5173/student/101/form/f-001"
    }
  ],
  "notifications_failed": [
    {
      "student_id": 102,
      "reason": "missing email"
    }
  ],
  "summary": {
    "total_students": 2,
    "success_count": 1,
    "failed_count": 1
  }
}
```

### Validation Error (400)
```json
{
  "code": 400,
  "message": "section_id is required and must be a non-empty string"
}
```

### Not Found / Empty Section (404)
```json
{
  "section_id": "IS213-2026-01",
  "notifications_created": [],
  "notifications_failed": [],
  "summary": {
    "total_students": 0,
    "success_count": 0,
    "failed_count": 0
  },
  "message": "no enrolled students"
}
```

## Status Codes

- `201`: all notifications published successfully to RabbitMQ.
- `207`: mixed outcome (some students succeeded, some failed).
- `400`: invalid request payload.
- `404`: section has no enrollments or does not exist.
- `502`: downstream dependency errors (e.g., Student/Student Form failures).
- `503`: notification publish failures (RabbitMQ unavailable/unhealthy).

## Orchestration Flow

1. Validate `section_id`.
2. Fetch enrollments from Enrollment service.
3. If no enrollments are found, probe Section service to distinguish missing section vs empty section.
4. For each enrolled student:
   - fetch student details from Student service,
   - validate email,
   - create student form via Student Form service,
   - build form link,
   - publish a notification message (with generic message + form link) to RabbitMQ.
5. Publish one RabbitMQ batch message containing all valid per-student notifications for the section.
6. Return a consolidated per-student success/failure summary.

## RabbitMQ Message Payload

The service now publishes a single message per API request, with all student notifications inside `notifications`.

```json
{
  "event_type": "FormLinksGeneratedBatch",
  "section_id": "IS213-2026-01",
  "notifications": [
    {
      "to": "student1@university.edu",
      "subject": "Action Required: Complete Your Teamder Student Form",
      "body": "Please complete your Teamder student form using the link provided.\n\nhttp://localhost:5173/student/101/form/f-001",
      "metadata": {
        "event_type": "FormLinkGenerated",
        "student_id": 101,
        "section_id": "IS213-2026-01",
        "form_id": "f-001",
        "template_key": "student_form_link_v1",
        "idempotency_key": "IS213-2026-01:101:f-001"
      },
      "event_type": "FormLinkGenerated",
      "student_id": 101,
      "email": "student1@university.edu",
      "section_id": "IS213-2026-01",
      "form_id": "f-001",
      "form_url": "http://localhost:5173/student/101/form/f-001",
      "message": "Please complete your Teamder student form using the link provided.",
      "template_key": "student_form_link_v1",
      "idempotency_key": "IS213-2026-01:101:f-001"
    }
  ]
}
```

Each element inside `notifications` retains the legacy per-recipient message format for backward-compatible consumer handling.

## API Contract Compatibility

- Frontend request payload remains unchanged: `POST /formation-notifications` with `section_id`.
- Frontend response payload remains unchanged: `notifications_created`, `notifications_failed`, and `summary`.
- The batching change is internal between formation-notification and notification via RabbitMQ.

## Environment Variables

- `PORT` (default: `4004`)
- `REQUEST_TIMEOUT` (default: `10`)
- `ENROLLMENT_URL`
- `STUDENT_SERVICE_URL`
- `STUDENT_FORM_URL`
- `SECTION_URL`
- `FORM_LINK_URL_TEMPLATE`
- `FORM_LINK_GENERIC_MESSAGE`
- `FORM_LINK_SUBJECT`
- `FORM_LINK_TEMPLATE_KEY`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`
- `NOTIFICATION_EXCHANGE`, `NOTIFICATION_EXCHANGE_TYPE`, `NOTIFICATION_ROUTING_KEY`
- `AMQP_RETRY_COUNT`, `AMQP_RETRY_WAIT_SECONDS`
