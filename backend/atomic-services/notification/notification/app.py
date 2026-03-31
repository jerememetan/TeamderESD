import json
import logging
import os
import re
import smtplib
import threading
import time
from email.message import EmailMessage
from typing import Any, Dict, Optional, Tuple

import pika
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from pika.exceptions import AMQPConnectionError

load_dotenv()

app = Flask(__name__)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [notification-service] %(message)s",
)
logger = logging.getLogger(__name__)

RABBIT_HOST = os.getenv("RABBITMQ_HOST", os.getenv("RABBIT_HOST", "localhost"))
RABBIT_PORT = int(os.getenv("RABBITMQ_PORT", os.getenv("RABBIT_PORT", "5672")))
RABBIT_USER = os.getenv("RABBITMQ_USER", os.getenv("RABBIT_USER", "guest"))
RABBIT_PASSWORD = os.getenv("RABBITMQ_PASSWORD", os.getenv("RABBIT_PASSWORD", "guest"))
RABBIT_VHOST = os.getenv("RABBITMQ_VHOST", os.getenv("RABBIT_VHOST", "/"))

EXCHANGE_NAME = os.getenv("NOTIFICATION_EXCHANGE", "notification.topic")
EXCHANGE_TYPE = os.getenv("NOTIFICATION_EXCHANGE_TYPE", "topic")
PUBLISH_ROUTING_KEY = os.getenv("NOTIFICATION_ROUTING_KEY", "notification.email")
CONSUMER_QUEUE = os.getenv("NOTIFICATION_EMAIL_QUEUE", "notification.email.queue")
CONSUMER_ROUTING_KEYS = [
    key.strip()
    for key in os.getenv("NOTIFICATION_CONSUMER_ROUTING_KEYS", PUBLISH_ROUTING_KEY).split(",")
    if key.strip()
]
if not CONSUMER_ROUTING_KEYS:
    CONSUMER_ROUTING_KEYS = [PUBLISH_ROUTING_KEY]

ERROR_EXCHANGE = os.getenv("NOTIFICATION_ERROR_EXCHANGE", EXCHANGE_NAME)
ERROR_ROUTING_KEY = os.getenv("NOTIFICATION_ERROR_ROUTING_KEY", "notification.email.error")
PUBLISH_ERROR_EVENTS = os.getenv("NOTIFICATION_PUBLISH_ERROR_EVENTS", "true").lower() == "true"

AMQP_RETRY_COUNT = int(os.getenv("AMQP_RETRY_COUNT", "3"))
AMQP_RETRY_WAIT_SECONDS = float(os.getenv("AMQP_RETRY_WAIT_SECONDS", "1.5"))
CONSUMER_CONNECT_RETRY_SECONDS = float(os.getenv("NOTIFICATION_CONSUMER_CONNECT_RETRY_SECONDS", "3"))
CONSUMER_PREFETCH_COUNT = int(os.getenv("NOTIFICATION_CONSUMER_PREFETCH", "5"))
CONSUMER_ENABLED = os.getenv("NOTIFICATION_CONSUMER_ENABLED", "true").lower() == "true"

SMTP_HOST = os.getenv("GMAIL_SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("GMAIL_SMTP_PORT", "587"))
SMTP_USER = os.getenv("GMAIL_SMTP_USER", "")
SMTP_PASSWORD = os.getenv("GMAIL_SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("EMAIL_FROM", SMTP_USER)
SMTP_TIMEOUT_SECONDS = float(os.getenv("GMAIL_SMTP_TIMEOUT_SECONDS", "20"))

EMAIL_MAX_RETRIES = int(os.getenv("EMAIL_SEND_MAX_RETRIES", "3"))
EMAIL_RETRY_BACKOFF_SECONDS = float(os.getenv("EMAIL_SEND_RETRY_BACKOFF_SECONDS", "2"))
EMAIL_SEND_DELAY_SECONDS = float(os.getenv("EMAIL_SEND_DELAY_SECONDS", "0"))

DEFAULT_FORM_LINK_SUBJECT = os.getenv(
    "DEFAULT_FORM_LINK_SUBJECT", "Action Required: Complete Your Teamder Student Form"
)
DEFAULT_FORM_LINK_TEMPLATE = os.getenv(
    "DEFAULT_FORM_LINK_TEMPLATE",
    (
        "Hello,\n\n"
        "Please complete your student form using the link below:\n{form_url}\n\n"
        "Section: {section_id}\n"
        "Student ID: {student_id}\n\n"
        "Thank you."
    ),
)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

CORS(app, resources={r"/notification/*": {"origins": [FRONTEND_ORIGIN]}})

_metrics_lock = threading.Lock()
_metrics = {
    "processed": 0,
    "sent": 0,
    "send_failures": 0,
    "dead_lettered": 0,
    "invalid_messages": 0,
    "retries": 0,
}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _inc_metric(name: str, by: int = 1) -> None:
    with _metrics_lock:
        _metrics[name] = _metrics.get(name, 0) + by


def _safe_json_loads(raw: bytes) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        decoded = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        return None, f"payload is not valid UTF-8: {exc}"

    try:
        parsed = json.loads(decoded)
    except json.JSONDecodeError as exc:
        return None, f"payload is not valid JSON: {exc}"

    if not isinstance(parsed, dict):
        return None, "payload must be a JSON object"
    return parsed, None


def _mask_email(email: str) -> str:
    if not isinstance(email, str) or "@" not in email:
        return "<invalid-email>"
    local, domain = email.split("@", 1)
    if not local:
        return f"***@{domain}"
    if len(local) == 1:
        return f"{local}***@{domain}"
    return f"{local[0]}***{local[-1]}@{domain}"


def _is_valid_email(value: Any) -> bool:
    return isinstance(value, str) and bool(EMAIL_RE.match(value.strip()))


def _extract_email_payload(message: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    # Preferred shape: to, subject, body
    if "to" in message or "subject" in message or "body" in message:
        to_value = message.get("to")
        subject = message.get("subject")
        body = message.get("body")
        if not _is_valid_email(to_value):
            return None, "field 'to' must be a valid email"
        if not isinstance(subject, str) or not subject.strip():
            return None, "field 'subject' is required and must be a non-empty string"
        if not isinstance(body, str) or not body.strip():
            return None, "field 'body' is required and must be a non-empty string"

        payload = {
            "to": to_value.strip(),
            "subject": subject.strip(),
            "body": body,
            "is_html": bool(message.get("is_html", False)),
            "reply_to": message.get("reply_to"),
            "headers": message.get("headers", {}),
            "metadata": message.get("metadata", {}),
        }
        return payload, None

    # Backward-compatible shape from existing publisher endpoint.
    if message.get("event_type") == "FormLinkGenerated":
        to_value = message.get("email")
        form_url = message.get("form_url")
        if not _is_valid_email(to_value):
            return None, "field 'email' must be a valid email for FormLinkGenerated"
        if not isinstance(form_url, str) or not form_url.strip():
            return None, "field 'form_url' is required for FormLinkGenerated"

        subject = message.get("subject") or DEFAULT_FORM_LINK_SUBJECT
        try:
            body = DEFAULT_FORM_LINK_TEMPLATE.format(
                form_url=form_url,
                section_id=message.get("section_id", "N/A"),
                student_id=message.get("student_id", "N/A"),
            )
        except Exception:
            body = f"Please complete your student form: {form_url}"

        payload = {
            "to": to_value.strip(),
            "subject": subject,
            "body": body,
            "is_html": bool(message.get("is_html", False)),
            "reply_to": message.get("reply_to"),
            "headers": message.get("headers", {}),
            "metadata": {
                "event_type": message.get("event_type"),
                "student_id": message.get("student_id"),
                "section_id": message.get("section_id"),
            },
        }
        return payload, None

    return None, "message does not match expected email schema"


def _classify_smtp_error(exc: Exception) -> Tuple[bool, str]:
    if isinstance(exc, smtplib.SMTPResponseException):
        code = int(getattr(exc, "smtp_code", 0) or 0)
        details = str(getattr(exc, "smtp_error", b""))
        if 400 <= code < 500:
            return True, f"smtp temporary failure ({code}): {details}"
        return False, f"smtp permanent failure ({code}): {details}"

    transient_types = (
        smtplib.SMTPConnectError,
        smtplib.SMTPServerDisconnected,
        smtplib.SMTPHeloError,
    )
    if isinstance(exc, transient_types):
        return True, f"smtp transient failure: {exc}"

    if isinstance(exc, smtplib.SMTPException):
        return False, f"smtp permanent failure: {exc}"

    return True, str(exc)


def _send_email_once(email_payload: Dict[str, Any]) -> None:
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError("Gmail SMTP credentials are not configured")

    msg = EmailMessage()
    msg["From"] = SMTP_FROM or SMTP_USER
    msg["To"] = email_payload["to"]
    msg["Subject"] = email_payload["subject"]

    reply_to = email_payload.get("reply_to")
    if isinstance(reply_to, str) and reply_to.strip():
        msg["Reply-To"] = reply_to.strip()

    headers = email_payload.get("headers")
    if isinstance(headers, dict):
        for key, value in headers.items():
            if not isinstance(key, str) or not isinstance(value, str):
                continue
            if key.lower() in {"from", "to", "subject"}:
                continue
            msg[key] = value

    body = email_payload["body"]
    if email_payload.get("is_html"):
        msg.set_content("This email contains HTML content. Please view it in an HTML-capable mail client.")
        msg.add_alternative(body, subtype="html")
    else:
        msg.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
        smtp.starttls()
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        smtp.send_message(msg)


def _send_email_with_retry(email_payload: Dict[str, Any]) -> Tuple[bool, bool, str, int]:
    attempts = 0
    for attempt in range(1, EMAIL_MAX_RETRIES + 1):
        attempts = attempt
        try:
            _send_email_once(email_payload)
            return True, False, "sent", attempt
        except Exception as exc:
            is_transient, detail = _classify_smtp_error(exc)
            if is_transient and attempt < EMAIL_MAX_RETRIES:
                _inc_metric("retries", 1)
                sleep_s = EMAIL_RETRY_BACKOFF_SECONDS * attempt
                logger.warning(
                    "SMTP transient failure for recipient=%s attempt=%s/%s; retrying in %.1fs (%s)",
                    _mask_email(email_payload.get("to", "")),
                    attempt,
                    EMAIL_MAX_RETRIES,
                    sleep_s,
                    detail,
                )
                time.sleep(sleep_s)
                continue
            return False, is_transient, detail, attempts

    return False, True, "exhausted retries", attempts


def _build_connection_parameters() -> pika.ConnectionParameters:
    credentials = pika.PlainCredentials(RABBIT_USER, RABBIT_PASSWORD)
    return pika.ConnectionParameters(
        host=RABBIT_HOST,
        port=RABBIT_PORT,
        virtual_host=RABBIT_VHOST,
        credentials=credentials,
        heartbeat=300,
        blocked_connection_timeout=300,
    )


def publish_message(payload: Dict[str, Any], routing_key: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    last_error = None
    target_routing_key = routing_key or PUBLISH_ROUTING_KEY

    for _ in range(AMQP_RETRY_COUNT):
        connection = None
        try:
            connection = pika.BlockingConnection(_build_connection_parameters())
            channel = connection.channel()
            channel.exchange_declare(
                exchange=EXCHANGE_NAME,
                exchange_type=EXCHANGE_TYPE,
                durable=True,
            )
            channel.basic_publish(
                exchange=EXCHANGE_NAME,
                routing_key=target_routing_key,
                body=json.dumps(payload),
                properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
            )
            return True, None
        except Exception as exc:
            last_error = str(exc)
            time.sleep(AMQP_RETRY_WAIT_SECONDS)
        finally:
            if connection and connection.is_open:
                connection.close()

    return False, last_error


def _publish_error_event(
    channel: pika.adapters.blocking_connection.BlockingChannel,
    original_payload: Optional[Dict[str, Any]],
    error_code: str,
    error_message: str,
    message_context: Dict[str, Any],
) -> None:
    if not PUBLISH_ERROR_EVENTS:
        return

    event_payload = {
        "event_type": "EmailNotificationFailed",
        "error": {"code": error_code, "message": error_message},
        "context": message_context,
        "payload": original_payload,
        "timestamp": int(time.time()),
    }

    try:
        channel.exchange_declare(
            exchange=ERROR_EXCHANGE,
            exchange_type=EXCHANGE_TYPE,
            durable=True,
        )
        channel.basic_publish(
            exchange=ERROR_EXCHANGE,
            routing_key=ERROR_ROUTING_KEY,
            body=json.dumps(event_payload),
            properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
        )
        _inc_metric("dead_lettered", 1)
    except Exception as exc:
        logger.exception("Failed to publish error event: %s", exc)


def _handle_email_message(ch, method, properties, body) -> None:
    _inc_metric("processed", 1)

    parsed, parse_error = _safe_json_loads(body)
    if parse_error:
        logger.error("Rejecting invalid JSON message (tag=%s): %s", method.delivery_tag, parse_error)
        _inc_metric("invalid_messages", 1)
        _publish_error_event(
            ch,
            None,
            "INVALID_JSON",
            parse_error,
            {"delivery_tag": method.delivery_tag, "routing_key": method.routing_key},
        )
        ch.basic_reject(delivery_tag=method.delivery_tag, requeue=False)
        return

    email_payload, payload_error = _extract_email_payload(parsed)
    if payload_error:
        logger.error("Rejecting invalid email payload (tag=%s): %s", method.delivery_tag, payload_error)
        _inc_metric("invalid_messages", 1)
        _publish_error_event(
            ch,
            parsed,
            "INVALID_PAYLOAD",
            payload_error,
            {"delivery_tag": method.delivery_tag, "routing_key": method.routing_key},
        )
        ch.basic_reject(delivery_tag=method.delivery_tag, requeue=False)
        return

    recipient_masked = _mask_email(email_payload["to"])
    logger.info(
        "Attempting email send for recipient=%s event_type=%s",
        recipient_masked,
        parsed.get("event_type", "direct_email"),
    )

    success, is_transient, detail, attempts = _send_email_with_retry(email_payload)

    if success:
        logger.info("Email sent successfully to recipient=%s attempts=%s", recipient_masked, attempts)
        _inc_metric("sent", 1)
        ch.basic_ack(delivery_tag=method.delivery_tag)
    else:
        _inc_metric("send_failures", 1)
        error_code = "SMTP_TRANSIENT_FAILURE" if is_transient else "SMTP_PERMANENT_FAILURE"
        logger.error(
            "Email send failed recipient=%s attempts=%s transient=%s error=%s",
            recipient_masked,
            attempts,
            is_transient,
            detail,
        )
        _publish_error_event(
            ch,
            parsed,
            error_code,
            detail,
            {
                "delivery_tag": method.delivery_tag,
                "routing_key": method.routing_key,
                "recipient": recipient_masked,
                "attempts": attempts,
            },
        )
        # Ack to avoid infinite poison-message loops.
        ch.basic_ack(delivery_tag=method.delivery_tag)

    if EMAIL_SEND_DELAY_SECONDS > 0:
        time.sleep(EMAIL_SEND_DELAY_SECONDS)


def _consume_loop() -> None:
    logger.info(
        "Starting email consumer exchange=%s queue=%s routing_keys=%s",
        EXCHANGE_NAME,
        CONSUMER_QUEUE,
        CONSUMER_ROUTING_KEYS,
    )

    while True:
        connection = None
        try:
            connection = pika.BlockingConnection(_build_connection_parameters())
            channel = connection.channel()
            channel.exchange_declare(
                exchange=EXCHANGE_NAME,
                exchange_type=EXCHANGE_TYPE,
                durable=True,
            )
            channel.queue_declare(queue=CONSUMER_QUEUE, durable=True)
            for routing_key in CONSUMER_ROUTING_KEYS:
                channel.queue_bind(
                    exchange=EXCHANGE_NAME,
                    queue=CONSUMER_QUEUE,
                    routing_key=routing_key,
                )

            channel.basic_qos(prefetch_count=CONSUMER_PREFETCH_COUNT)
            channel.basic_consume(
                queue=CONSUMER_QUEUE,
                on_message_callback=_handle_email_message,
                auto_ack=False,
            )
            logger.info("Email consumer ready and consuming queue=%s", CONSUMER_QUEUE)
            channel.start_consuming()

        except AMQPConnectionError as exc:
            logger.warning(
                "AMQP connection error in consumer, reconnecting in %.1fs: %s",
                CONSUMER_CONNECT_RETRY_SECONDS,
                exc,
            )
            time.sleep(CONSUMER_CONNECT_RETRY_SECONDS)
        except Exception as exc:
            logger.exception(
                "Unexpected consumer error, reconnecting in %.1fs: %s",
                CONSUMER_CONNECT_RETRY_SECONDS,
                exc,
            )
            time.sleep(CONSUMER_CONNECT_RETRY_SECONDS)
        finally:
            if connection and connection.is_open:
                connection.close()


def _start_consumer_thread_if_enabled(debug_enabled: bool = False) -> None:
    if not CONSUMER_ENABLED:
        logger.info("Notification consumer is disabled (NOTIFICATION_CONSUMER_ENABLED=false)")
        return

    # Avoid duplicate consumer thread with Flask debug reloader.
    is_reloader_parent = os.getenv("WERKZEUG_RUN_MAIN") != "true" and debug_enabled
    if is_reloader_parent:
        return

    thread = threading.Thread(target=_consume_loop, daemon=True, name="email-consumer")
    thread.start()


@app.route("/health", methods=["GET"])
def health():
    with _metrics_lock:
        metrics = dict(_metrics)

    return (
        jsonify(
            {
                "status": "ok",
                "service": "notification-service",
                "consumer": {
                    "enabled": CONSUMER_ENABLED,
                    "queue": CONSUMER_QUEUE,
                    "routing_keys": CONSUMER_ROUTING_KEYS,
                    "prefetch": CONSUMER_PREFETCH_COUNT,
                },
                "metrics": metrics,
            }
        ),
        200,
    )


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

        ok, error = publish_message(message_payload, routing_key=PUBLISH_ROUTING_KEY)
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

    return (
        jsonify(
            {
                "code": 200,
                "data": {
                    "success_count": success_count,
                    "failure_count": failure_count,
                    "statuses": statuses,
                },
            }
        ),
        200,
    )


@app.route("/notification/publish-email", methods=["POST"])
def publish_direct_email():
    payload = request.get_json() or {}
    email_payload, payload_error = _extract_email_payload(payload)
    if payload_error:
        return jsonify({"code": 400, "message": payload_error}), 400

    ok, error = publish_message(
        {
            "to": email_payload["to"],
            "subject": email_payload["subject"],
            "body": email_payload["body"],
            "is_html": email_payload.get("is_html", False),
            "reply_to": email_payload.get("reply_to"),
            "headers": email_payload.get("headers", {}),
            "metadata": email_payload.get("metadata", {}),
        },
        routing_key=PUBLISH_ROUTING_KEY,
    )

    if not ok:
        return jsonify({"code": 502, "message": f"amqp publish failed: {error}"}), 502

    return jsonify({"code": 200, "message": "email queued"}), 200


if __name__ == "__main__":
    debug_enabled = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    _start_consumer_thread_if_enabled(debug_enabled=debug_enabled)
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3016")), debug=debug_enabled)
