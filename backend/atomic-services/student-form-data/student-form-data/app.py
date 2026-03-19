from flask import Flask
from dotenv import load_dotenv
import os
from .models.form_data_model import db

def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SUPABASE_URL")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    print(app.config["SQLALCHEMY_DATABASE_URI"])

    db.init_app(app)
    from .models.form_data_model import FormData
    from .routes.form_data_routes import form_data_bp
    app.register_blueprint(form_data_bp, url_prefix="/form-data")

    return app

if __name__ == '__main__':
    app = create_app()
    PORT = os.getenv("PORT", 3010)
    app.run(host='0.0.0.0', port=PORT, debug=False)
