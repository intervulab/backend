# Full demo setup

Clone all five repos as **siblings** (same parent directory), checkout branch **`integration/demo`** on each:

- `backend` (C3)
- `interviewlab-frontend` (C1)
- `interviewlab-system-canvas` (C2)
- `interviewlab-agent-orchestrator` (C4)
- `intervulab` (C5 ML)

See [INTEGRATION.md](./INTEGRATION.md) for ports and env vars.

## Option A — Docker + system Node (recommended on a fresh laptop)

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 nodejs npm python3-venv libsndfile1 jq curl
sudo usermod -aG docker "$USER"   # then log out/in
```

```bash
cd backend
docker compose -f docker-compose.integration.yml up -d
cp .env.example .env
npm install && npx prisma migrate deploy && npm run dev
```

Start C4/C5 with venv or Docker (see `interviewlab-frontend/docs/LOCAL_DEMO.md`).

## Option B — No Docker (embedded Postgres + venvs)

1. Create Python venvs for C4 and C5 (`uv` or `python3 -m venv`), install from each repo’s `requirements.txt`.
2. Start Postgres: `node backend/scripts/start-embedded-postgres.mjs`
3. Run the stack helper (from any directory; set `INTERVIEWLAB_ROOT` if repos are not two levels above `backend/scripts/`):

```bash
chmod +x backend/scripts/run-full-demo.sh
export INTERVIEWLAB_ROOT="$HOME/work/interviewlab"   # parent of backend/, intervulab/, etc.
./backend/scripts/run-full-demo.sh
```

Override optional tooling paths with `INTERVIEWLAB_NODE` and `INTERVIEWLAB_UV` if needed.

## OpenAI (live AI questions)

Copy `interviewlab-agent-orchestrator/.env.example` to `.env` and set `OPENAI_API_KEY`. Restart uvicorn on port **8000** after edits.

Pin note: C4 requires `httpx==0.27.2` with current `langchain-openai` (see agent `requirements.txt`).

## URLs when running

| App | URL |
|-----|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:4000 |
| Canvas | http://localhost:3001 |
| Agent docs | http://localhost:8000/docs |
| ML docs | http://localhost:8001/docs |

Smoke test: `backend/scripts/demo-spine.sh`
