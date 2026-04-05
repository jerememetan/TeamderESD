import os
import time

import pika
from pika.exceptions import AMQPConnectionError


EXCHANGE_NAME = "notification.topic"
EXCHANGE_TYPE = "topic"

SWAP_EXCHANGE_NAME = "swap_topic"
SWAP_EXCHANGE_TYPE = "topic"

EMAIL_QUEUE = "notification.email.queue"
SMS_QUEUE = "notification.sms.queue"
SWAP_NOTIFICATION_QUEUE = "swap.notification.bridge.queue"

EMAIL_ROUTING_KEY = "notification.email"
SMS_ROUTING_KEY = "notification.sms"
SWAP_EVENT_ROUTING_KEYS = [
    "SwapWindowScheduled",
    "SwapWindowOpened",
    "SwapRejected",
    "SwapExecuted",
    "SwapFailed",
]


def get_connection_parameters() -> pika.ConnectionParameters:
    host = os.getenv("RABBITMQ_HOST", "localhost")
    port = int(os.getenv("RABBITMQ_PORT", "5672"))
    username = os.getenv("RABBITMQ_USER", "guest")
    password = os.getenv("RABBITMQ_PASSWORD", "guest")
    virtual_host = os.getenv("RABBITMQ_VHOST", "/")

    credentials = pika.PlainCredentials(username, password)
    return pika.ConnectionParameters(
        host=host,
        port=port,
        virtual_host=virtual_host,
        credentials=credentials,
        heartbeat=60,
        blocked_connection_timeout=30,
    )


def wait_for_rabbitmq(
    parameters: pika.ConnectionParameters,
    max_attempts: int = 20,
    delay_seconds: int = 3,
) -> pika.BlockingConnection:
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            return pika.BlockingConnection(parameters)
        except AMQPConnectionError as exc:
            last_error = exc
            print(
                f"[Attempt {attempt}/{max_attempts}] RabbitMQ not ready yet. "
                f"Retrying in {delay_seconds}s..."
            )
            time.sleep(delay_seconds)

    raise RuntimeError("Could not connect to RabbitMQ after multiple attempts.") from last_error


def setup_topology(channel: pika.adapters.blocking_connection.BlockingChannel) -> None:
    channel.exchange_declare(
        exchange=EXCHANGE_NAME,
        exchange_type=EXCHANGE_TYPE,
        durable=True,
    )
    channel.exchange_declare(
        exchange=SWAP_EXCHANGE_NAME,
        exchange_type=SWAP_EXCHANGE_TYPE,
        durable=True,
    )

    channel.queue_declare(queue=EMAIL_QUEUE, durable=True)
    channel.queue_declare(queue=SMS_QUEUE, durable=True)
    channel.queue_declare(queue=SWAP_NOTIFICATION_QUEUE, durable=True)

    channel.queue_bind(
        queue=EMAIL_QUEUE,
        exchange=EXCHANGE_NAME,
        routing_key=EMAIL_ROUTING_KEY,
    )
    channel.queue_bind(
        queue=SMS_QUEUE,
        exchange=EXCHANGE_NAME,
        routing_key=SMS_ROUTING_KEY,
    )
    for routing_key in SWAP_EVENT_ROUTING_KEYS:
        channel.queue_bind(
            queue=SWAP_NOTIFICATION_QUEUE,
            exchange=SWAP_EXCHANGE_NAME,
            routing_key=routing_key,
        )


def main() -> None:
    parameters = get_connection_parameters()
    connection = wait_for_rabbitmq(parameters)
    channel = connection.channel()
    setup_topology(channel)
    connection.close()

    print("RabbitMQ topology setup completed successfully.")
    print(f"Exchange: {EXCHANGE_NAME}")
    print(f"Swap Exchange: {SWAP_EXCHANGE_NAME}")
    print(f"Queues: {EMAIL_QUEUE}, {SMS_QUEUE}")
    print(f"Bindings: {EMAIL_ROUTING_KEY}, {SMS_ROUTING_KEY}")
    print(f"Swap Queue: {SWAP_NOTIFICATION_QUEUE}")
    print(f"Swap Bindings: {', '.join(SWAP_EVENT_ROUTING_KEYS)}")


if __name__ == "__main__":
    main()
