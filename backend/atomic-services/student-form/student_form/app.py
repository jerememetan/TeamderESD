from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os
from .models.form_model import db


def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    CORS(app, resources={r"/student-form/*": {"origins": [frontend_origin]}})

    db.init_app(app)
    from .models.form_model import StudentFormTemplate, StudentFormSubmission, StudentFormLink
    from .routes.form_routes import student_form_bp

    app.register_blueprint(student_form_bp, url_prefix="/student-form")
    return app


if __name__ == "__main__":
    app = create_app()
    port = os.getenv("PORT", 3015)
    app.run(host="0.0.0.0", port=port, debug=False)
