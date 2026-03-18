from flask import Flask
from .models.topic_model import db
from dotenv import load_dotenv

import os

def create_app():
    load_dotenv()
    
    app = Flask(__name__)
    
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    from .models.topic_model import Topic
    from .routes.topic_routes import topic_bp
    app.register_blueprint(topic_bp, url_prefix="/topic")
    
    return app

if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3002)
    app.run(host='0.0.0.0', port=PORT, debug=False)
