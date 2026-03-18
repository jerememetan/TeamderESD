from flask import Flask
from .models.skill_model import db
from dotenv import load_dotenv

import os

def create_app():
    load_dotenv()
    
    app = Flask(__name__)
    
    
    
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    print(app.config["SQLALCHEMY_DATABASE_URI"])

    db.init_app(app)
    from .models.skill_model import Skill
    from .routes.skill_routes import skill_bp
    app.register_blueprint(skill_bp, url_prefix="/skill")
    
    return app

if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3001)
    app.run(host='0.0.0.0', port=PORT, debug=False)
