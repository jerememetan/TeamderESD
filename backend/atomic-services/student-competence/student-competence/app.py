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
from .models.competence_model import db

def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    print(app.config["SQLALCHEMY_DATABASE_URI"])

    db.init_app(app)
    from .models.competence_model import Competence
    from .routes.competence_routes import competence_bp
    app.register_blueprint(competence_bp, url_prefix="/competence")
    register_swagger(app, 'student-competence-service')
    return app
if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3008)
    app.run(host='0.0.0.0', port=PORT, debug=False)

