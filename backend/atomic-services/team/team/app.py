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
from flask_cors import CORS
from .models.team_model import db
from dotenv import load_dotenv
import os

def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    CORS(
        app,
        resources={r"/team*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")}},
    )
    db.init_app(app)
    from .models.team_model import Team, TeamStudent
    from .routes.team_routes import team_bp
    app.register_blueprint(team_bp, url_prefix="/team")
    register_swagger(app, 'team-service')
    return app
if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3007)
    app.run(host='0.0.0.0', port=PORT, debug=False)

