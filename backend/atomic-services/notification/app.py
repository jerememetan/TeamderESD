import json
import os
import time

import pika
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

RABBIT_HOST = os.getenv("RABBIT_HOST", "localhost")
RABBIT_PORT = int(os.getenv("RABBIT_PORT", "5672"))
EXCHANGE_NAME = os.getenv("NOTIFICATION_EXCHANGE", "notification_topic")
EXCHANGE_TYPE = os.getenv("NOTIFICATION_EXCHANGE_TYPE", "topic")
ROUTING_KEY = os.getenv("NOTIFICATION_ROUTING_KEY", "FormLinkNotification")
RETRY_COUNT = int(os.getenv("AMQP_RETRY_COUNT", "3"))
RETRY_WAIT_SECONDS = float(os.getenv("AMQP_RETRY_WAIT_SECONDS", "1.5"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

CORS(app, resources={r"/notification/*": {"origins": [FRONTEND_ORIGIN]}})


def publish_message(payload):
    last_error = None
    for _ in range(RETRY_COUNT):
        connection = None
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=RABBIT_HOST,
                    port=RABBIT_PORT,
                    heartbeat=300,
                    blocked_connection_timeout=300,
                )
            )
            channel = connection.channel()
            channel.exchange_declare(
                exchange=EXCHANGE_NAME,
                exchange_type=EXCHANGE_TYPE,
                durable=True,
            )
            channel.basic_publish(
                exchange=EXCHANGE_NAME,
                routing_key=ROUTING_KEY,
                body=json.dumps(payload),
                properties=pika.BasicProperties(delivery_mode=2),
            )
            return True, None
        except Exception as exc:
            last_error = str(exc)
            time.sleep(RETRY_WAIT_SECONDS)
        finally:
            if connection and connection.is_open:
                connection.close()
    return False, last_error


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "notification-service"}), 200


@app.route("/notification/send-form-link", methods=["POST"])
def send_form_links():
    payload = request.get_json() or {}
    recipients = payload.get("recipients", [])
    if not isinstance(recipients, list) or len(recipients) == 0:
        return jsonify({"code": 400, "message": "recipients array is required"}), 400

    statuses = []
    success_count = 0
    failure_count = 0

    for row in recipients:
        student_id = row.get("student_id")
        email = row.get("email")
        form_url = row.get("form_url")
        section_id = row.get("section_id")

        if not email or not form_url:
            failure_count += 1
            statuses.append(
                {
                    "student_id": student_id,
                    "email": email,
                    "delivery_status": "failed",
                    "message": "missing email or form_url",
                }
            )
            continue

        message_payload = {
            "event_type": "FormLinkGenerated",
            "student_id": student_id,
            "email": email,
            "section_id": section_id,
            "form_url": form_url,
        }
        ok, error = publish_message(message_payload)
        if ok:
            success_count += 1
            statuses.append(
                {
                    "student_id": student_id,
                    "email": email,
                    "delivery_status": "success",
                    "message": "queued for delivery",
                }
            )
        else:
            failure_count += 1
            statuses.append(
                {
                    "student_id": student_id,
                    "email": email,
                    "delivery_status": "failed",
                    "message": f"amqp publish failed: {error}",
                }
            )

    return jsonify(
        {
            "code": 200,
            "data": {
                "success_count": success_count,
                "failure_count": failure_count,
                "statuses": statuses,
            },
        }
    ), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3016")), debug=True)
