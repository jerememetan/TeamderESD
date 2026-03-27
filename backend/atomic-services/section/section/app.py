from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

from .models.section_model import db


def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    # Enable CORS for all routes
    CORS(app)

    from .routes.section_routes import section_bp

    app.register_blueprint(section_bp, url_prefix="/section")
    return app


if __name__ == "__main__":
    app = create_app()
    PORT = os.getenv("PORT", 3018)
    app.run(host="0.0.0.0", port=PORT, debug=False)
