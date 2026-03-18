from flask import Flask
from .models.criteria_model import db
from dotenv import load_dotenv

import os

def create_app():
    load_dotenv()
    
    app = Flask(__name__)
    
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    from .models.criteria_model import Criteria
    from .routes.criteria_routes import criteria_bp
    app.register_blueprint(criteria_bp, url_prefix="/criteria")
    
    return app

if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3004)
    app.run(host='0.0.0.0', port=PORT, debug=False)
