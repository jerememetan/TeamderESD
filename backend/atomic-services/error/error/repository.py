from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from .models import ErrorLog, db


def serialize_error_log(row: ErrorLog) -> Dict[str, Any]:
    return {
        "id": row.id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "source_service": row.source_service,
        "routing_key": row.routing_key,
        "error_code": row.error_code,
        "error_message": row.error_message,
        "correlation_id": row.correlation_id,
        "context_json": row.context_json,
        "status": row.status,
    }


def _base_query(status: Optional[str] = None):
    query = ErrorLog.query
    if status:
        query = query.filter(ErrorLog.status == status)
    else:
        query = query.filter(ErrorLog.status != "DELETED")
    return query


def list_error_logs(
    *,
    page: int,
    page_size: int,
    source_service: Optional[str] = None,
    routing_key: Optional[str] = None,
    status: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Tuple[list[Dict[str, Any]], Dict[str, int]]:
    query = _base_query(status=status)

    if source_service:
        query = query.filter(ErrorLog.source_service == source_service)
    if routing_key:
        query = query.filter(ErrorLog.routing_key == routing_key)
    if correlation_id:
        query = query.filter(ErrorLog.correlation_id == correlation_id)

    total = query.count()
    total_pages = max((total + page_size - 1) // page_size, 1) if total else 0
    rows = (
        query.order_by(ErrorLog.created_at.desc(), ErrorLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return [serialize_error_log(row) for row in rows], {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


def get_error_log(error_id: int) -> Optional[ErrorLog]:
    return ErrorLog.query.get(error_id)


def create_error_log(**fields: Any) -> ErrorLog:
    row = ErrorLog(**fields)
    db.session.add(row)
    db.session.commit()
    return row


def soft_delete_error_log(error_id: int) -> Optional[ErrorLog]:
    row = ErrorLog.query.get(error_id)
    if row is None:
        return None

    if row.status != "DELETED":
        row.status = "DELETED"
        db.session.commit()
    return row