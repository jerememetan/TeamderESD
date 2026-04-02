from __future__ import annotations

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from sqlalchemy import text

from swagger_helper import register_swagger

from .consumer import start_consumer_thread
from .models import db
from .repository import get_error_log, list_error_logs, soft_delete_error_log
from .schemas import ErrorLogResponseSchema


def _truthy(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _error_response(code: str, message: str, http_status: int):
    return jsonify({"error": {"code": code, "message": message}}), http_status


def create_app() -> Flask:
    load_dotenv()

    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL", "sqlite:///error.db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    with app.app_context():
        if not app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite"):
            db.session.execute(text("CREATE SCHEMA IF NOT EXISTS error"))
            db.session.commit()
        db.create_all()

    response_schema = ErrorLogResponseSchema()

    @app.get("/health")
    def health():
        return jsonify({"data": {"status": "ok", "service": "error-service"}, "meta": {}}), 200

    @app.get("/errors")
    def get_errors():
        try:
            page = max(int(request.args.get("page", 1)), 1)
            page_size = min(max(int(request.args.get("page_size", 25)), 1), 100)
        except ValueError:
            return _error_response("INVALID_PAGINATION", "page and page_size must be integers", 400)

        source_service = request.args.get("source_service") or None
        routing_key = request.args.get("routing_key") or None
        status = request.args.get("status") or None
        correlation_id = request.args.get("correlation_id") or None

        rows, meta = list_error_logs(
            page=page,
            page_size=page_size,
            source_service=source_service,
            routing_key=routing_key,
            status=status,
            correlation_id=correlation_id,
        )

        return jsonify({"data": rows, "meta": meta}), 200

    @app.get("/errors/<int:error_id>")
    def get_error(error_id: int):
        row = get_error_log(error_id)
        if row is None or row.status == "DELETED":
            return _error_response("NOT_FOUND", "Error log not found", 404)

        return jsonify({"data": response_schema.dump(row), "meta": {}}), 200

    @app.delete("/errors/<int:error_id>")
    def delete_error(error_id: int):
        row = soft_delete_error_log(error_id)
        if row is None:
            return _error_response("NOT_FOUND", "Error log not found", 404)

        return jsonify({"data": response_schema.dump(row), "meta": {}}), 200

    if _truthy(os.getenv("ENABLE_SWAGGER", "false")):
        register_swagger(app, "error-service")

    if _truthy(os.getenv("ERROR_CONSUMER_ENABLED", "true")):
        start_consumer_thread(app)

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "3019"))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)