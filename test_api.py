"""Simulate POST /api/chat via Flask test client (no separate server process)."""

import os
import time

# Load root .env using an absolute path so this works from any terminal directory.
from dotenv import load_dotenv

_dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".env"))
if os.path.isfile(_dotenv_path):
    load_dotenv(dotenv_path=_dotenv_path, override=True)
else:
    print(f"test_api: WARNING — .env not found at {_dotenv_path}")

# Import app after env is loaded; index.py also runs load_dotenv on import.
from api.index import app

RETRY_DELAY_SEC = 2
MAX_ATTEMPTS = 3


def main():
    key = os.getenv("GEMINI_API_KEY") or ""
    if len(key) >= 8:
        print(f"test_api: GEMINI_API_KEY in process starts with: {key[:8]}...")
    else:
        print("test_api: GEMINI_API_KEY not set or too short — check root .env")

    with app.test_client() as client:
        last_res = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            last_res = client.post(
                "/api/chat",
                json={"message": "Reply with exactly one word: OK"},
                content_type="application/json",
            )
            data = last_res.get_json(silent=True) or {}
            if last_res.status_code == 200 and data.get("success"):
                break
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_DELAY_SEC)
        print("HTTP", last_res.status_code)
        print("Content-Type:", last_res.headers.get("Content-Type"))
        print("JSON:", last_res.get_json(silent=True))


if __name__ == "__main__":
    main()
