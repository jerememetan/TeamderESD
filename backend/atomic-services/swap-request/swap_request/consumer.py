import json
import os
import threading
import uuid

from sqlalchemy import func

from . import amqp_lib
from .models.swap_request_model import SwapRequest, db

RABBIT_HOST = os.environ.get("rabbit_host", "localhost")
RABBIT_PORT = int(os.environ.get("rabbit_port", 5672))
EXCHANGE_NAME = os.environ.get("exchange_name", "swap_topic")
EXCHANGE_TYPE = os.environ.get("exchange_type", "topic")
QUEUE_NAME = os.environ.get("queue_name", "SwapRequestStatusQueue")

# RabbitMQ routing keys consumed by this service.
ROUTING_KEYS = ["SwapRejected", "SwapExecuted", "SwapFailed"]

EVENT_TO_STATUS = {
    "swaprejected": "REJECTED",
    "swapexecuted": "EXECUTED",
    "swapfailed": "FAILED",
}

TERMINAL_STATUSES = {"REJECTED", "EXECUTED", "FAILED"}


def _normalize_event(event_name):
    return (event_name or "").strip().lower().replace("_", "")


def process_status_event(payload, routing_key, source="rabbitmq"):
    # Shared status update logic.
    # source="rabbitmq" means async consume path.
    # source="http-simulated" means manual Postman test path.
    event_name = payload.get("event_type") or routing_key
    event_key = _normalize_event(event_name)
    new_status = EVENT_TO_STATUS.get(event_key)
    if not new_status:
        return {
            "code": 400,
            "message": f"Invalid event type: {event_name}",
            "source": source,
            "http_status": 400,
        }

    swap_request_id = payload.get("swap_request_id")
    if not swap_request_id:
        return {
            "code": 400,
            "message": "Missing swap_request_id",
            "source": source,
            "http_status": 400,
        }

    try:
        parsed_id = uuid.UUID(str(swap_request_id))
    except ValueError:
        return {
            "code": 400,
            "message": "Invalid swap_request_id format",
            "source": source,
            "http_status": 400,
        }

    request_row = SwapRequest.query.get(parsed_id)
    if not request_row:
        return {
            "code": 404,
            "message": f"Swap request not found for id={swap_request_id}",
            "source": source,
            "http_status": 404,
        }

    if request_row.status in TERMINAL_STATUSES and request_row.status == new_status:
        return {
            "code": 200,
            "message": f"Dummy success ({source}): status already {new_status}; idempotent event accepted.",
            "data": {
                "swap_request_id": str(request_row.swap_request_id),
                "status": request_row.status,
                "event_type": event_name,
            },
            "http_status": 200,
        }

    request_row.status = new_status
    request_row.updated_at = func.now()
    db.session.commit()
    return {
        "code": 200,
        "message": f"Dummy success ({source}): processed {event_name} and updated status.",
        "data": {
            "swap_request_id": str(request_row.swap_request_id),
            "status": request_row.status,
            "event_type": event_name,
        },
        "http_status": 200,
    }


def _build_callback(app):
    def callback(channel, method, properties, body):
        # RabbitMQ consume path: callback receives SwapRejected/SwapExecuted/SwapFailed events.
        try:
            payload = json.loads(body)
        except Exception as exception:
            print(f"Failed to parse message body as JSON: {exception}")
            return

        with app.app_context():
            try:
                result = process_status_event(payload, method.routing_key, source="rabbitmq")
                print(result.get("message"))
            except Exception as exception:
                db.session.rollback()
                print(f"Failed to process status event: {exception}")

    return callback


def _run_consumer(app):
    callback = _build_callback(app)
    amqp_lib.start_consuming(
        hostname=RABBIT_HOST,
        port=RABBIT_PORT,
        exchange_name=EXCHANGE_NAME,
        exchange_type=EXCHANGE_TYPE,
        queue_name=QUEUE_NAME,
        routing_keys=ROUTING_KEYS,
        callback=callback,
    )


def start_consumer_thread(app):
    thread = threading.Thread(target=_run_consumer, args=(app,), daemon=True)
    thread.start()
