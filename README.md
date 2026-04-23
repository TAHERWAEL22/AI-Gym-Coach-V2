# AI Gym Coach — ARIA

Production-ready setup for deployment on **Vercel** (Python Serverless + static frontend).

## Local Development

1) Install Python deps:

```bash
py -m pip install -r requirements.txt
```

2) Create a local env file (optional for local only):

- Create `backend/.env` and add:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=models/gemini-flash-latest
```

3) Run the API locally:

```bash
py api/index.py
# or
py -m api.index
```

4) Open the frontend:

- Open `frontend/index.html` in your browser (or serve the folder with any static server).

## Vercel Deployment

### Environment Variables (Required)

In Vercel Dashboard → Project → Settings → Environment Variables:

- **`GEMINI_API_KEY`**: your Gemini API key

Optional:

- **`GEMINI_MODEL`**: defaults to `models/gemini-flash-latest`

### Notes

- Backend entrypoint is `api/index.py`.
- All `/api/*` requests are rewritten to the Flask app via `vercel.json`.
- SQLite uses `/tmp/gym_coach.db` on Vercel (ephemeral storage).

