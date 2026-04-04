"""
Peer Evaluation Atomic Service

Manages peer evaluation rounds and student submissions.
Stores rounds and ratings in Supabase, computes reputation deltas on round close.
"""

import os
import sys
from pathlib import Path

# Ensure the package directory is on sys.path for imports
_this_dir = Path(__file__).resolve().parent
if str(_this_dir) not in sys.path:
    sys.path.insert(0, str(_this_dir))
if str(_this_dir.parent) not in sys.path:
    sys.path.insert(0, str(_this_dir.parent))

from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/peer-eval*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")}})

# Database config
db_url = os.getenv("SUPABASE_URL", "")
if not db_url:
    print("WARNING: SUPABASE_URL is not set. Database operations will fail.")
    db_url = "sqlite:///fallback.db"

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_size": 5,
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Init SQLAlchemy
from models.peer_eval_model import db, PeerEvalRound, PeerEvalSubmission
db.init_app(app)

# Register routes
from routes.peer_eval_routes import peer_eval_bp
app.register_blueprint(peer_eval_bp)


@app.route("/peer-eval/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "peer-evaluation-service"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 3020)), debug=True)
