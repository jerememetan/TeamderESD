import os

from dotenv import load_dotenv
from flask import Flask

from .models.swap_constraint_model import db


def create_app():
    load_dotenv()

    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    from .routes.swap_constraint_routes import swap_constraint_bp

    app.register_blueprint(swap_constraint_bp, url_prefix="/swap-constraints")

    return app


if __name__ == "__main__":
    app = create_app()
    port = os.getenv("PORT", 3012)
    app.run(host="0.0.0.0", port=port, debug=False)
