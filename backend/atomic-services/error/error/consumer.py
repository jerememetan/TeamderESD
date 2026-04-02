from __future__ import annotations

import json
import os
import threading
import time
from contextlib import suppress
from typing import Any, Dict, Optional, Tuple

import pika
from pika.exceptions import AMQPConnectionError

from .repository import create_error_log


DEFAULT_EXCHANGE_NAME = "notification.topic"
DEFAULT_EXCHANGE_TYPE = "topic"
DEFAULT_QUEUE_NAME = "error.error-log.queue"
DEFAULT_ROUTING_KEYS = ["#.error"]


def _truthy(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _build_connection_parameters() -> pika.ConnectionParameters:
    host = os.getenv("RABBITMQ_HOST", os.getenv("RABBIT_HOST", "localhost"))
    port = int(os.getenv("RABBITMQ_PORT", os.getenv("RABBIT_PORT", "5672")))
    user = os.getenv("RABBITMQ_USER", os.getenv("RABBIT_USER", "guest"))
    password = os.getenv("RABBITMQ_PASSWORD", os.getenv("RABBIT_PASSWORD", "guest"))
    virtual_host = os.getenv("RABBITMQ_VHOST", os.getenv("RABBIT_VHOST", "/"))

    return pika.ConnectionParameters(
        host=host,
        port=port,
        virtual_host=virtual_host,
        credentials=pika.PlainCredentials(user, password),
        heartbeat=300,
        blocked_connection_timeout=60,
    )


def _get_exchange_name() -> str:
    return os.getenv("ERROR_EXCHANGE_NAME", os.getenv("NOTIFICATION_ERROR_EXCHANGE", DEFAULT_EXCHANGE_NAME))


def _get_exchange_type() -> str:
    return os.getenv("ERROR_EXCHANGE_TYPE", DEFAULT_EXCHANGE_TYPE)


def _get_queue_name() -> str:
    return os.getenv("ERROR_QUEUE_NAME", DEFAULT_QUEUE_NAME)


def _get_routing_keys() -> list[str]:
    raw = os.getenv("ERROR_ROUTING_KEYS", ",".join(DEFAULT_ROUTING_KEYS))
    routing_keys = [key.strip() for key in raw.split(",") if key.strip()]
    return routing_keys or DEFAULT_ROUTING_KEYS


def _safe_json_loads(body: bytes) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        decoded = body.decode("utf-8")
    except UnicodeDecodeError as exc:
        return None, f"payload is not valid UTF-8: {exc}"

    try:
        parsed = json.loads(decoded)
    except json.JSONDecodeError as exc:
        return None, f"payload is not valid JSON: {exc}"

    if not isinstance(parsed, dict):
        return None, "payload must be a JSON object"
    return parsed, None


def _derive_source_service(message: Dict[str, Any], routing_key: str) -> str:
    explicit = message.get("source_service")
    if isinstance(explicit, str) and explicit.strip():
        return explicit.strip()

    if routing_key.endswith(".error"):
        return routing_key[: -len(".error")]

    return routing_key


def _extract_error_details(message: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Optional[str], Any]:
    error_block = message.get("error") if isinstance(message.get("error"), dict) else {}
    error_code = message.get("error_code") or error_block.get("code")
    error_message = message.get("error_message") or error_block.get("message") or message.get("message")
    correlation_id = message.get("correlation_id")

    if not isinstance(error_message, str) or not error_message.strip():
        return None, None, None, None

    context_json = message.get("context_json")
    if context_json is None:
        context_json = {
            "event_type": message.get("event_type"),
            "context": message.get("context"),
            "payload": message.get("payload"),
            "timestamp": message.get("timestamp"),
        }

    if not isinstance(context_json, (dict, list)):
        context_json = {"value": context_json}

    return (
        error_code if isinstance(error_code, str) else None,
        error_message.strip(),
        correlation_id if isinstance(correlation_id, str) else None,
        context_json,
    )


def _store_error_message(message: Dict[str, Any], routing_key: str) -> bool:
    error_code, error_message, correlation_id, context_json = _extract_error_details(message)
    if error_message is None:
        return False

    source_service = _derive_source_service(message, routing_key)

    create_error_log(
        source_service=source_service,
        routing_key=routing_key,
        error_code=error_code,
        error_message=error_message,
        correlation_id=correlation_id,
        context_json=context_json,
        status="OPEN",
    )
    return True


def _handle_message(channel, method, properties, body) -> None:
    parsed, parse_error = _safe_json_loads(body)
    if parse_error:
        channel.basic_reject(delivery_tag=method.delivery_tag, requeue=False)
        return

    stored = _store_error_message(parsed, method.routing_key)
    if stored:
        channel.basic_ack(delivery_tag=method.delivery_tag)
    else:
        channel.basic_reject(delivery_tag=method.delivery_tag, requeue=False)


def consume_errors(app) -> None:
    exchange_name = _get_exchange_name()
    exchange_type = _get_exchange_type()
    queue_name = _get_queue_name()
    routing_keys = _get_routing_keys()

    while True:
        connection = None
        try:
            connection = pika.BlockingConnection(_build_connection_parameters())
            channel = connection.channel()
            channel.exchange_declare(exchange=exchange_name, exchange_type=exchange_type, durable=True)
            channel.queue_declare(queue=queue_name, durable=True)

            for routing_key in routing_keys:
                channel.queue_bind(queue=queue_name, exchange=exchange_name, routing_key=routing_key)

            channel.basic_qos(prefetch_count=int(os.getenv("ERROR_CONSUMER_PREFETCH", "10")))

            def callback(ch, method, properties, body):
                with app.app_context():
                    _handle_message(ch, method, properties, body)

            channel.basic_consume(queue=queue_name, on_message_callback=callback, auto_ack=False)
            channel.start_consuming()
        except AMQPConnectionError:
            time.sleep(float(os.getenv("ERROR_CONSUMER_RETRY_SECONDS", "3")))
        except KeyboardInterrupt:
            break
        except Exception:
            time.sleep(float(os.getenv("ERROR_CONSUMER_RETRY_SECONDS", "3")))
        finally:
            with suppress(Exception):
                if connection and connection.is_open:
                    connection.close()


def start_consumer_thread(app) -> Optional[threading.Thread]:
    if not _truthy(os.getenv("ERROR_CONSUMER_ENABLED", "true")):
        return None

    thread = threading.Thread(target=consume_errors, args=(app,), daemon=True)
    thread.start()
    return thread