import json
import os
import time
from typing import Any, Dict, List, Optional, Tuple

import pika

from pathlib import Path
import sys

_p = Path(__file__).resolve()
_COMPOSITE_ROOT = None
for ancestor in [_p] + list(_p.parents):
    candidate = Path(ancestor)
    if (candidate / "error_publisher.py").exists() or candidate.name == "composite-services":
        _COMPOSITE_ROOT = candidate
        break
if _COMPOSITE_ROOT is None:
    _COMPOSITE_ROOT = _p.parents[2] if len(_p.parents) > 2 else _p.parent
if str(_COMPOSITE_ROOT) not in sys.path:
    sys.path.append(str(_COMPOSITE_ROOT))

from error_publisher import publish_error_event

RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", os.getenv("RABBIT_HOST", "localhost"))
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", os.getenv("RABBIT_PORT", "5672")))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", os.getenv("RABBIT_USER", "guest"))
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", os.getenv("RABBIT_PASSWORD", "guest"))
RABBITMQ_VHOST = os.getenv("RABBITMQ_VHOST", os.getenv("RABBIT_VHOST", "/"))

NOTIFICATION_EXCHANGE = os.getenv("NOTIFICATION_EXCHANGE", "notification.topic")
NOTIFICATION_EXCHANGE_TYPE = os.getenv("NOTIFICATION_EXCHANGE_TYPE", "topic")
NOTIFICATION_ROUTING_KEY = os.getenv("NOTIFICATION_ROUTING_KEY", "notification.email")
AMQP_RETRY_COUNT = int(os.getenv("AMQP_RETRY_COUNT", "3"))
AMQP_RETRY_WAIT_SECONDS = float(os.getenv("AMQP_RETRY_WAIT_SECONDS", "1.5"))
SERVICE_NAME = "peer-eval-notification-service"


def _connection_parameters() -> pika.ConnectionParameters:
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
    return pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        virtual_host=RABBITMQ_VHOST,
        credentials=credentials,
        heartbeat=300,
        blocked_connection_timeout=300,
    )


def _publish_notification_payload(
    payload: Dict[str, Any], routing_key: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    last_error = None
    target_routing_key = routing_key or NOTIFICATION_ROUTING_KEY

    for _ in range(AMQP_RETRY_COUNT):
        connection = None
        try:
            connection = pika.BlockingConnection(_connection_parameters())
            channel = connection.channel()
            channel.exchange_declare(
                exchange=NOTIFICATION_EXCHANGE,
                exchange_type=NOTIFICATION_EXCHANGE_TYPE,
                durable=True,
            )
            channel.basic_publish(
                exchange=NOTIFICATION_EXCHANGE,
                routing_key=target_routing_key,
                body=json.dumps(payload),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    content_type="application/json",
                ),
            )
            return True, None
        except Exception as exc:
            last_error = str(exc)
            time.sleep(AMQP_RETRY_WAIT_SECONDS)
        finally:
            if connection and connection.is_open:
                connection.close()

    publish_error_event(
        source_service=SERVICE_NAME,
        downstream_service="rabbitmq",
        error_code="NOTIFICATION_PUBLISH_FAILED",
        error_message=last_error or "failed to publish notification",
        request_context={"routing_key": target_routing_key, "operation": "publish-notification"},
        response_payload=payload,
        routing_key=f"{SERVICE_NAME}.error",
    )

    return False, last_error


def publish_peer_eval_notification_batch(
    section_id: str,
    round_id: str,
    notifications: List[Dict[str, Any]],
    title: Optional[str] = None,
    due_at: Optional[str] = None,
    routing_key: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    batch_payload = {
        "event_type": "PeerEvalInitiatedBatch",
        "section_id": section_id,
        "round_id": round_id,
        "title": title,
        "due_at": due_at,
        "notifications": notifications,
    }
    return _publish_notification_payload(payload=batch_payload, routing_key=routing_key)
