
from flask import Flask
from flask_cors import CORS
from .models.enrollment_model import db
from dotenv import load_dotenv
import os

def create_app():
    load_dotenv()
    app = Flask(__name__)
    CORS(app)  # Enable CORS for all routes
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    from .routes.enrollment_routes import enrollment_bp
    app.register_blueprint(enrollment_bp, url_prefix="/enrollment")
    return app

if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3005)
    app.run(host='0.0.0.0', port=PORT, debug=False)
