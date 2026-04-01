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
import os
from flask_cors import CORS
from dotenv import load_dotenv
from flask import Flask

from .models.swap_request_model import db


def create_app():
    load_dotenv()

    app = Flask(__name__)

    # PLACEHOLDER: set SUPABASE_URL to your SQLAlchemy connection string.
    # Example format: postgresql://<user>:<password>@<host>:5432/<database>
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    
    CORS(app)

    from .routes.swap_request_routes import swap_request_bp

    app.register_blueprint(swap_request_bp, url_prefix="/swap-request")
    register_swagger(app, 'swap-request-service')
    return app
if __name__ == "__main__":
    app = create_app()
    port = os.getenv("PORT", 3011)
    app.run(host="0.0.0.0", port=port, debug=False)

