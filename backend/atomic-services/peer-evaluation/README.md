# Peer Evaluation Service (Atomic)

**Port:** 3020
**Base URL:** `/peer-eval`

Manages peer evaluation rounds and student submissions. Stores data in Supabase.

## Supabase Setup

Run `supabase_migration.sql` in the Supabase SQL Editor to create the required tables.

## Endpoints

### POST /peer-eval/rounds
Create a new peer evaluation round.

**Body:**
```json
{
  "section_id": "22222222-2222-2222-2222-222222222222",
  "title": "Peer Evaluation Round 1",
  "due_at": "2026-04-10T23:59:59Z"
}
```

**Response (201):** Created round object.
**Response (409):** Active round already exists for this section.

### GET /peer-eval/rounds?section_id={uuid}&status={active|closed}
List rounds, optionally filtered.

### GET /peer-eval/rounds/{round_id}
Get round details with submission count.

### POST /peer-eval/rounds/{round_id}/submit
Student submits evaluations for all teammates.

**Body:**
```json
{
  "evaluator_id": 101,
  "team_id": "team-uuid",
  "entries": [
    { "evaluatee_id": 102, "rating": 4, "justification": "Great teammate" },
    { "evaluatee_id": 103, "rating": 3, "justification": "Did okay" }
  ]
}
```

**Response (201):** Created submissions.
**Response (409):** Evaluator already submitted for this round.

### GET /peer-eval/rounds/{round_id}/submissions?evaluator_id={int}
Get submissions for a round, optionally filtered by evaluator.

### POST /peer-eval/rounds/{round_id}/close
Close round and compute reputation deltas.

**Response (200):**
```json
{
  "code": 200,
  "data": {
    "round": { "round_id": "...", "status": "closed", ... },
    "reputation_deltas": [
      { "student_id": 101, "avg_rating": 4.2, "num_evaluations": 4, "delta": 12 },
      { "student_id": 102, "avg_rating": 2.5, "num_evaluations": 4, "delta": -5 }
    ]
  }
}
```

Delta formula: `round((avg_rating - 3.0) * 10)`
- Rating 3.0 = neutral (delta 0)
- Rating 5.0 = max positive (delta +20)
- Rating 1.0 = max negative (delta -20)

## Dashboard Orchestrator Integration

Two new orchestrator endpoints coordinate the full peer eval flow:

### POST /dashboard/peer-eval/initiate
Instructor initiates a round. Orchestrator creates round, fetches teams/emails, sends notifications.

### POST /dashboard/peer-eval/close
Instructor closes a round. Orchestrator closes round, pushes reputation deltas to Reputation Service.
