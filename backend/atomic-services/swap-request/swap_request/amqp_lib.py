"""Reusable AMQP utilities for RabbitMQ consumer connectivity."""

import time

import pika


def connect(hostname, port, exchange_name, exchange_type, max_retries=12, retry_interval=5):
    retries = 0

    while retries < max_retries:
        retries += 1
        try:
            print(f"Connecting to AMQP broker {hostname}:{port}...")
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=hostname,
                    port=port,
                    heartbeat=300,
                    blocked_connection_timeout=300,
                )
            )
            channel = connection.channel()

            # Declare exchange if missing so consumer can boot consistently.
            channel.exchange_declare(
                exchange=exchange_name,
                exchange_type=exchange_type,
                durable=True,
            )

            return connection, channel
        except pika.exceptions.AMQPConnectionError as exception:
            print(f"Failed to connect: {exception}")
            print(f"Retrying in {retry_interval} seconds...")
            time.sleep(retry_interval)

    raise Exception(f"Max {max_retries} retries exceeded")


def close(connection, channel):
    if channel and channel.is_open:
        channel.close()
    if connection and connection.is_open:
        connection.close()


def start_consuming(hostname, port, exchange_name, exchange_type, queue_name, routing_keys, callback):
    connection = None

    while True:
        try:
            connection, channel = connect(
                hostname=hostname,
                port=port,
                exchange_name=exchange_name,
                exchange_type=exchange_type,
            )

            channel.queue_declare(queue=queue_name, durable=True)
            for routing_key in routing_keys:
                channel.queue_bind(
                    exchange=exchange_name,
                    queue=queue_name,
                    routing_key=routing_key,
                )

            print(f"Consuming from queue: {queue_name}")
            channel.basic_consume(
                queue=queue_name,
                on_message_callback=callback,
                auto_ack=True,
            )
            channel.start_consuming()

        except pika.exceptions.ConnectionClosedByBroker:
            print("Connection closed by broker. Reconnecting...")
            continue
        except KeyboardInterrupt:
            if connection:
                close(connection, channel)
            break
