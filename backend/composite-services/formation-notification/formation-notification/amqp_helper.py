import json
import os
import time
from typing import Any, Dict, Optional, Tuple

import pika

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


def publish_notification_message(
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

    return False, last_error
