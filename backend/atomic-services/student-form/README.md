# Student Form Service

Atomic service that generates section-specific student form templates from instructor criteria/weights and stores student submissions.

## Endpoints

- `POST /student-form/template`
  - Create or update the generated template for a section.
  - Body:
    - `section_id` (uuid)
    - `criteria` (object, e.g. includes `mbti_weight`, `buddy_weight`, `topic_weight`, `skill_weight`)
    - `custom_entries` (optional list from group form builder)

- `GET /student-form/template?section_id=<uuid>`
  - Fetch generated template fields for student UI rendering.

- `POST /student-form/submission`
  - Create or update a student's answers for a section.
  - Body:
    - `section_id` (uuid)
    - `student_id` (int)
    - `responses` (object keyed by template field key)

- `GET /student-form/submission?section_id=<uuid>&student_id=<id>`
  - Fetch one student submission.

- `GET /student-form/submissions?section_id=<uuid>`
  - Fetch all submissions in section (for analytics/orchestration).

## Notes

- Service is isolated and does not modify any existing service.
- Expected DB schemas/tables:
  - `student_form.form_template`
  - `student_form.form_submission`
