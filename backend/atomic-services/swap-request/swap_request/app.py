import os

from dotenv import load_dotenv
from flask import Flask

from .consumer import start_consumer_thread
from .models.swap_request_model import db


def create_app():
    load_dotenv()

    app = Flask(__name__)

    # PLACEHOLDER: set SUPABASE_URL to your SQLAlchemy connection string.
    # Example format: postgresql://<user>:<password>@<host>:5432/<database>
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    from .routes.swap_request_routes import swap_request_bp

    app.register_blueprint(swap_request_bp, url_prefix="/swap-request")

    # RabbitMQ consumer thread only handles async status updates from backend events.
    start_consumer_thread(app)

    return app


if __name__ == "__main__":
    app = create_app()
    port = os.getenv("PORT", 3011)
    app.run(host="0.0.0.0", port=port, debug=False)
