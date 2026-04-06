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
from sqlalchemy import text
from .models.topic_preference_model import db

def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    print(app.config["SQLALCHEMY_DATABASE_URI"])

    db.init_app(app)
    from .models.topic_preference_model import TopicPreference
    from .routes.topic_preference_routes import topic_preference_bp

    with app.app_context():
        # Keep local/dev resilient after database wipes.
        db.session.execute(text("CREATE SCHEMA IF NOT EXISTS student_topic_preference"))
        db.session.commit()
        db.create_all()

    app.register_blueprint(topic_preference_bp, url_prefix="/topic-preference")
    register_swagger(app, 'student-topic-preference-service')
    return app
if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3009)
    app.run(host='0.0.0.0', port=PORT, debug=False)

