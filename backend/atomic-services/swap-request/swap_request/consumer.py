import uuid

from sqlalchemy import func

from .models.swap_request_model import SwapRequest, db

TERMINAL_STATUSES = {"REJECTED", "EXECUTED", "FAILED"}


def _update_swap_request_status(swap_request_id, new_status, action_label):
    try:
        parsed_id = uuid.UUID(str(swap_request_id))
    except ValueError:
        return {
            "code": 400,
            "message": "Invalid swap_request_id format",
            "http_status": 400,
        }

    request_row = SwapRequest.query.get(parsed_id)
    if not request_row:
        return {
            "code": 404,
            "message": f"Swap request not found for id={swap_request_id}",
            "http_status": 404,
        }

    if request_row.status in TERMINAL_STATUSES and request_row.status == new_status:
        return {
            "code": 200,
            "message": f"Success: status already {new_status}; idempotent update accepted.",
            "data": {
                "swap_request_id": str(request_row.swap_request_id),
                "status": request_row.status,
                "action": action_label,
            },
            "http_status": 200,
        }

    request_row.status = new_status
    request_row.updated_at = func.now()
    db.session.commit()
    return {
        "code": 200,
        "message": f"Success: {action_label} and updated status.",
        "data": {
            "swap_request_id": str(request_row.swap_request_id),
            "status": request_row.status,
            "action": action_label,
        },
        "http_status": 200,
    }


def update_status_directly(swap_request_id, status):
    return _update_swap_request_status(
        swap_request_id=swap_request_id,
        new_status=status,
        action_label=f"set status to {status}",
    )
