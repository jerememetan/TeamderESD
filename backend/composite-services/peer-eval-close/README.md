# Peer Eval Close Composite Service

This service owns instructor peer evaluation close orchestration.

## Base URL

- Default: `/peer-eval-close` (port: 4009)

## POST /peer-eval-close

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
    },
    "section_update": {
      "attempted": true,
      "updated": true,
      "section_id": "...",
      "from_stage": "confirmed",
      "to_stage": "completed",
      "message": "section stage updated to completed"
    }
  }
}
```

## GET /peer-eval-close/health

Returns service health.

## Notes

- Uses shared `error_publisher` to publish downstream failures.
- Preserves existing close flow behavior and response envelope.
- Returns partial failure details for reputation and section update stages while still completing orchestration.
