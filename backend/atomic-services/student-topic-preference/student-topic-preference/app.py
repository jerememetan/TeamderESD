from flask import Flask
from dotenv import load_dotenv
import os
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
    app.register_blueprint(topic_preference_bp, url_prefix="/topic-preference")

    return app

if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3009)
    app.run(host='0.0.0.0', port=PORT, debug=False)
