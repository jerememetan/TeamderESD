from pathlib import Path
import sys

_SWAGGER_PATH_CANDIDATES = [Path(__file__).resolve().parent, Path(__file__).resolve().parent.parent]
for _candidate in _SWAGGER_PATH_CANDIDATES:
    if (_candidate / "swagger_helper.py").exists():
        _candidate_str = str(_candidate)
        if _candidate_str not in sys.path:
            sys.path.append(_candidate_str)
        break

from swagger_helper import register_swagger
from flask import Flask
from dotenv import load_dotenv
import os
from .models.student_form_model import db


def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    from .models.student_form_model import StudentForm
    from .routes.student_form_routes import student_form_bp

    app.register_blueprint(student_form_bp, url_prefix="/student-form")
    register_swagger(app, 'student-form-service')
    return app
if __name__ == "__main__":
    app = create_app()
    port = os.getenv("PORT", 3015)
    app.run(host="0.0.0.0", port=port, debug=False)

