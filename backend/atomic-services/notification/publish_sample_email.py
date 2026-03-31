import argparse
import json
import os

import pika
from dotenv import load_dotenv

load_dotenv()

RABBIT_HOST = os.getenv("RABBITMQ_HOST", os.getenv("RABBIT_HOST", "localhost"))
RABBIT_PORT = int(os.getenv("RABBITMQ_PORT", os.getenv("RABBIT_PORT", "5672")))
RABBIT_USER = os.getenv("RABBITMQ_USER", os.getenv("RABBIT_USER", "guest"))
RABBIT_PASSWORD = os.getenv("RABBITMQ_PASSWORD", os.getenv("RABBIT_PASSWORD", "guest"))
RABBIT_VHOST = os.getenv("RABBITMQ_VHOST", os.getenv("RABBIT_VHOST", "/"))
EXCHANGE_NAME = os.getenv("NOTIFICATION_EXCHANGE", "notification.topic")
EXCHANGE_TYPE = os.getenv("NOTIFICATION_EXCHANGE_TYPE", "topic")
ROUTING_KEY = os.getenv("NOTIFICATION_ROUTING_KEY", "notification.email")


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a sample email event to RabbitMQ.")
    parser.add_argument("--to", required=True, help="Recipient email address")
    parser.add_argument("--subject", default="Teamder Test Email", help="Email subject")
    parser.add_argument(
        "--body",
        default="This is a sample email event published to notification.topic.",
        help="Email body",
    )
    parser.add_argument("--html", action="store_true", help="Treat body as HTML")
    args = parser.parse_args()

    payload = {
        "to": args.to,
        "subject": args.subject,
        "body": args.body,
        "is_html": args.html,
        "metadata": {"source": "publish_sample_email.py"},
    }

    credentials = pika.PlainCredentials(RABBIT_USER, RABBIT_PASSWORD)
    params = pika.ConnectionParameters(
        host=RABBIT_HOST,
        port=RABBIT_PORT,
        virtual_host=RABBIT_VHOST,
        credentials=credentials,
        heartbeat=300,
        blocked_connection_timeout=300,
    )

    connection = pika.BlockingConnection(params)
    try:
        channel = connection.channel()
        channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type=EXCHANGE_TYPE, durable=True)
        channel.basic_publish(
            exchange=EXCHANGE_NAME,
            routing_key=ROUTING_KEY,
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
        )
        print(
            f"Published sample email message to exchange={EXCHANGE_NAME} routing_key={ROUTING_KEY} for {args.to}"
        )
    finally:
        connection.close()


if __name__ == "__main__":
    main()
