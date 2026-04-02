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
from .models.enrollment_model import db
from dotenv import load_dotenv
import os

def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    from .routes.enrollment_routes import enrollment_bp
    app.register_blueprint(enrollment_bp, url_prefix="/enrollment")
    register_swagger(app, 'enrollment-service')
    return app
if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3005)
    app.run(host='0.0.0.0', port=PORT, debug=False)

