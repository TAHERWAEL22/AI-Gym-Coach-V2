import logging
import os

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import find_dotenv, load_dotenv

try:
    from .database import (
        init_db,
        get_user_profile,
        save_user_profile,
        update_user_weight,
        save_message,
        get_chat_history,
        clear_history,
    )
    from .ai_engine import chat, extract_weight_update, clean_response
except ImportError:
    # Allows running locally via: py api/index.py
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from api.database import (
        init_db,
        get_user_profile,
        save_user_profile,
        update_user_weight,
        save_message,
        get_chat_history,
        clear_history,
    )
    from api.ai_engine import chat, extract_weight_update, clean_response


API_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(API_DIR)
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

_log_level = getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO)
logging.basicConfig(level=_log_level)
for _noisy in ("google_genai", "httpx", "httpcore"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


def _load_local_env():
    # On Vercel, environment variables come from the dashboard.
    if os.environ.get("VERCEL"):
        return

    # Always resolve to an absolute path: <project_root>/.env
    dotenv_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", ".env")
    )

    if os.path.isfile(dotenv_path):
        os.environ.pop("GEMINI_API_KEY", None)
        load_dotenv(dotenv_path=dotenv_path, override=True)
        logger.debug("Loaded .env from: %s", dotenv_path)
    else:
        # Fallback: let python-dotenv search upward from cwd
        fallback = find_dotenv(filename=".env", usecwd=True)
        if fallback:
            os.environ.pop("GEMINI_API_KEY", None)
            load_dotenv(dotenv_path=fallback, override=True)
            logger.debug("Loaded .env (fallback) from: %s", fallback)
        else:
            logger.warning("No .env file found. Expected: %s", dotenv_path)

    _gk = os.getenv("GEMINI_API_KEY") or ""
    if len(_gk) >= 8:
        print(f"DEBUG: Using Key starting with: {_gk[:8]}...")
    else:
        print("DEBUG: GEMINI_API_KEY missing or shorter than 8 characters after load_dotenv")


_load_local_env()


app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app, resources={r"/api/*": {"origins": "*"}})

init_db()


@app.route("/favicon.ico")
def favicon():
    return "", 204


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({"online": True, "app": "AI Gym Coach", "version": "1.0.0"})


@app.route("/api/debug_env", methods=["GET"])
def debug_env():
    """Returns whether GEMINI_API_KEY is present — never exposes the actual value."""
    key_present = bool(os.getenv("GEMINI_API_KEY"))
    return jsonify({"gemini_api_key_set": key_present})


@app.route("/api/profile", methods=["GET"])
def get_profile():
    profile = get_user_profile()
    if profile:
        return jsonify({"success": True, "profile": profile})
    return jsonify({"success": False, "profile": None}), 200


@app.route("/api/profile", methods=["POST"])
def set_profile():
    data = request.get_json(force=True)
    required = ["name", "age", "height", "weight", "goal"]
    missing = [f for f in required if f not in data]

    if missing:
        return jsonify({"success": False, "error": f"Missing fields: {missing}"}), 400

    goal = str(data["goal"]).lower()
    if goal not in ("bulk", "cut", "fit"):
        return jsonify({"success": False, "error": "goal must be bulk | cut | fit"}), 400

    try:
        save_user_profile(
            name=str(data["name"]),
            age=int(data["age"]),
            height=float(data["height"]),
            weight=float(data["weight"]),
            goal=goal,
        )
        return jsonify({"success": True, "message": "Profile saved!"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/chat", methods=["POST"])
def chat_endpoint():
    data = request.get_json(force=True)
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"success": False, "error": "Empty message"}), 400

    profile = get_user_profile()
    history = get_chat_history(limit=20)

    result = chat(user_message, profile, history)
    if not result.get("success"):
        code = result.get("error_code") or "gemini_error"
        message = result.get("response") or "AI request failed."
        payload = {"success": False, "error": message, "error_code": code}
        detail = result.get("detail")
        if detail:
            payload["detail"] = detail
        http_status = {
            "leaked_api_key": 403,
            "rate_limit": 429,
            "permission_denied": 403,
            "missing_api_key": 503,
            "client_init_failed": 503,
            "gemini_error": 503,
        }.get(code, 503)
        logger.warning("Chat failed: code=%s http=%s message=%s", code, http_status, message)
        return jsonify(payload), http_status

    raw = str(result.get("response", ""))
    reply = clean_response(raw)
    weight_update = extract_weight_update(raw)

    save_message("user", user_message)
    save_message("model", reply)

    if weight_update is not None and profile:
        update_user_weight(weight_update)

    return jsonify({"success": True, "reply": reply, "weight_update": weight_update})


@app.route("/api/history", methods=["GET"])
def history_endpoint():
    history = get_chat_history(limit=50)
    return jsonify({"success": True, "history": history})


@app.route("/api/history", methods=["DELETE"])
def clear_history_endpoint():
    clear_history()
    return jsonify({"success": True, "message": "History cleared."})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=True)

