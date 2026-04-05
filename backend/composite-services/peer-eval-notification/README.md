# Peer Eval Notification Composite Service

This service owns instructor peer evaluation orchestration flows that were previously in dashboard-orchestrator.

## Base URL

- Default: `/peer-eval-notifications` (port: 4008)

## POST /peer-eval-notifications/initiate

Creates a peer evaluation round and dispatches notification messages through RabbitMQ for the notification service.

### Request
```json
{
  "section_id": "22222222-2222-2222-2222-222222222211",
  "title": "Peer Evaluation - Week 10",
  "due_at": "2026-04-20T23:59:59Z",
  "eval_link": "http://localhost:5173/student/peer-evaluation/custom-link"
}
```

### Success (201)
```json
{
  "code": 201,
  "data": {
    "round": {
      "round_id": "..."
    },
    "teams_count": 3,
    "notification_results": {
      "sent": 42,
      "failed": 0,
      "skipped": 1
    }
  }
}
```

### Conflict (409)
Pass-through from peer-evaluation when an active round already exists.

## POST /peer-eval-notifications/close

Closes a peer evaluation round and applies reputation deltas.

### Request
```json
{
  "round_id": "b7da7d23-38b2-4d38-87f7-358ff1ca9f13"
}
```

### Success (200)
```json
{
  "code": 200,
  "data": {
    "round": {},
    "reputation_deltas": [],
    "reputation_update_results": {
      "updated": 10,
      "failed": 0
    }
  }
}
```

## GET /peer-eval-notifications/health

Returns service health.

## Notes

- Uses RabbitMQ batch publishing for initiate notifications (`PeerEvalInitiatedBatch`).
- Uses shared `error_publisher` to publish downstream failures.
- Maintains frontend-compatible response shape for instructor initiate/close flows.
