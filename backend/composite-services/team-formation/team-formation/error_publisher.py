from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Optional

import pika


ERROR_EXCHANGE_NAME = os.getenv("ERROR_EXCHANGE_NAME", "notification.topic")
ERROR_EXCHANGE_TYPE = os.getenv("ERROR_EXCHANGE_TYPE", "topic")
ERROR_ROUTING_KEY_PREFIX = os.getenv("ERROR_ROUTING_KEY_PREFIX", "")
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", os.getenv("RABBIT_HOST", "localhost"))
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", os.getenv("RABBIT_PORT", "5672")))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", os.getenv("RABBIT_USER", "guest"))
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", os.getenv("RABBIT_PASSWORD", "guest"))
RABBITMQ_VHOST = os.getenv("RABBITMQ_VHOST", os.getenv("RABBIT_VHOST", "/"))
AMQP_RETRY_COUNT = int(os.getenv("ERROR_AMQP_RETRY_COUNT", os.getenv("AMQP_RETRY_COUNT", "3")))
AMQP_RETRY_WAIT_SECONDS = float(os.getenv("ERROR_AMQP_RETRY_WAIT_SECONDS", os.getenv("AMQP_RETRY_WAIT_SECONDS", "1.5")))


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


def publish_error_event(
    *,
    source_service: str,
    downstream_service: str,
    error_code: str,
    error_message: str,
    request_context: Optional[Dict[str, Any]] = None,
    http_status: Optional[int] = None,
    correlation_id: Optional[str] = None,
    response_payload: Optional[Any] = None,
    routing_key: Optional[str] = None,
) -> bool:
    payload = {
        "source_service": source_service,
        "downstream_service": downstream_service,
        "error_code": error_code,
        "error_message": error_message,
        "http_status": http_status,
        "correlation_id": correlation_id,
        "request_context": request_context or {},
        "response_payload": response_payload,
        "timestamp": int(time.time()),
    }

    target_routing_key = routing_key or f"{ERROR_ROUTING_KEY_PREFIX}{source_service}.error"

    for _ in range(AMQP_RETRY_COUNT):
        connection = None
        try:
            connection = pika.BlockingConnection(_connection_parameters())
            channel = connection.channel()
            channel.exchange_declare(
                exchange=ERROR_EXCHANGE_NAME,
                exchange_type=ERROR_EXCHANGE_TYPE,
                durable=True,
            )
            channel.basic_publish(
                exchange=ERROR_EXCHANGE_NAME,
                routing_key=target_routing_key,
                body=json.dumps(payload),
                properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
            )
            return True
        except Exception:
            time.sleep(AMQP_RETRY_WAIT_SECONDS)
        finally:
            if connection and connection.is_open:
                connection.close()

    return False
