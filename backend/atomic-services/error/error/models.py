import os

from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func


load_dotenv()

db = SQLAlchemy()

_database_uri = os.getenv("SUPABASE_URL", "sqlite:///error.db")
_uses_sqlite = _database_uri.startswith("sqlite")


class ErrorLog(db.Model):
    __tablename__ = "error_log"
    __table_args__ = {} if _uses_sqlite else {"schema": "error"}

    id = db.Column(
        db.BigInteger().with_variant(db.Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    source_service = db.Column(db.Text, nullable=False)
    routing_key = db.Column(db.Text, nullable=False)
    error_code = db.Column(db.Text, nullable=True)
    error_message = db.Column(db.Text, nullable=False)
    correlation_id = db.Column(db.Text, nullable=True)
    context_json = db.Column(db.JSON, nullable=True)
    status = db.Column(db.Text, nullable=False, server_default="OPEN")