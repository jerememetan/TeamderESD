import os

from dotenv import load_dotenv
from flask import Flask


def create_app():
    load_dotenv()

    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    from .routes.swap_routes import swap_bp

    app.register_blueprint(swap_bp, url_prefix="/team-swap")

    return app


if __name__ == "__main__":
    app = create_app()
    port = os.getenv("PORT", 3013)
    app.run(host="0.0.0.0", port=port, debug=False)
