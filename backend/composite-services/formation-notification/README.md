# Formation Notification Composite Service

This process/composite service orchestrates notification creation for a section.  
It does not own business data and does not persist email delivery status.

## Base URL

- `POST /formation_notifications` (port: `4004`)
- Backward-compatible alias: `POST /formation-notification/send-form-links`

## Request

```json
{
  "section_id": "IS213-2026-01",
  "initiated_by": "instructor_id_or_username"
}
```

## Response

```json
{
  "section_id": "IS213-2026-01",
  "notifications_created": [
    {
      "student_id": 101,
      "email": "student1@university.edu",
      "form_id": "f-001",
      "form_link": "http://localhost:5173/student/101/form/f-001",
      "status": "queued"
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
    "queued_count": 1,
    "failed_count": 1
  }
}
```

## Status Codes

- `201`: all notifications queued successfully.
- `207`: partial success (or per-student failures with no critical global failure).
- `400`: invalid request body (`section_id` missing/invalid).
- `404`: no section/no enrollments to notify.
- `502/503`: critical downstream dependency failure (Enrollment/Student/Student Form/RabbitMQ).

## Orchestration Sequence

1. Validate inbound JSON and `section_id`.
2. Fetch enrollments from Enrollment Service.
3. If no students returned, check Section Service to differentiate section-not-found vs no-enrollments.
4. For each enrolled student:
   - Fetch student details from Student Service.
   - Validate email.
   - Create/get form via Student Form Service.
   - Build form URL using `FORM_LINK_URL_TEMPLATE`.
   - Publish AMQP message to RabbitMQ exchange/routing key for Notification service consumption.
5. Return consolidated per-student success/failure summary.

## Internal Data Structures

- Inbound request:
  - `section_id: str`
  - `initiated_by: Optional[str]`
- Per-student result:
  - success: `{student_id, email, form_id, form_link, status}`
  - failure: `{student_id, reason}`
- RabbitMQ payload:
  - `event_type`, `student_id`, `email`, `section_id`, `form_id`, `form_url`, `subject`, `template_key`, `initiated_by`, `idempotency_key`
- Final response:
  - `section_id`, `notifications_created`, `notifications_failed`, `summary`

## Handler Skeleton

```python
@app.post("/formation_notifications")
def create_notifications():
    validate(section_id)
    enrollments = get_enrollments(section_id)
    for student_id in enrolled_students:
        student = get_student(student_id)
        if not valid_email(student.email):
            record_failure(...)
            continue
        form = create_form(section_id, student_id)
        if not form:
            record_failure(...)
            continue
        msg = build_notification_payload(student, form)
        ok = publish_to_rabbitmq(msg)
        record_success_or_failure(ok, ...)
    return consolidated_response(...)
```

## Environment Variables

- `PORT` (default: `4004`)
- `REQUEST_TIMEOUT` (default: `10`)
- `ENROLLMENT_URL`
- `STUDENT_SERVICE_URL`
- `STUDENT_FORM_URL`
- `SECTION_URL`
- `FORM_LINK_URL_TEMPLATE`
- `FORM_LINK_SUBJECT`
- `FORM_LINK_TEMPLATE_KEY`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`
- `NOTIFICATION_EXCHANGE`, `NOTIFICATION_EXCHANGE_TYPE`, `NOTIFICATION_ROUTING_KEY`
- `AMQP_RETRY_COUNT`, `AMQP_RETRY_WAIT_SECONDS`
