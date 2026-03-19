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

    return app

if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3008)
    app.run(host='0.0.0.0', port=PORT, debug=False)
