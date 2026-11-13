# InterviewLab — Local integration (Component 3 hub)

**Run locally:** [LOCAL_DEPLOYMENT.md](./LOCAL_DEPLOYMENT.md) (full stack) · [FULL_DEMO_SETUP.md](./FULL_DEMO_SETUP.md) (summary)

## Service ports

| Service | Port | Health |
|---------|------|--------|
| Frontend | 3000 | — |
| **Backend (this repo)** | **4000** | `/health` |
| Canvas | 3001 | — |
| Agent orchestrator (C4) | 8000 | `/health` |
| ML analytics (C5) | 8001 | `/health` |
| PostgreSQL | 5432 | — |

## Environment

Copy `.env.example` to `.env`. Requires:

- `DATABASE_URL`
- `AGENT_SERVICE_URL` (Component 4)
- `ML_SERVICE_URL` (Component 5)
- `GROQ_API_KEY` in Component 4 `.env` for live AI questions (Groq, not OpenAI on `integration/demo`)

## Flow

1. `POST /api/v1/sessions` → starts DB session + `POST` Component 4 `/interview/start` with `session_id` = DB UUID.
2. `POST /api/v1/questions/:id/answer` → Component 5 transcript/audio → Component 4 `/interview/answer`.
3. `POST /api/v1/sessions/:id/system-design` → Component 4 `/canvas/analyse`.
4. `POST /api/v1/sessions/:id/report` → Component 4 summary + Component 5 finalize.

## Demo script

From repo root (with all services running):

```bash
./scripts/demo-spine.sh
```

Requires `curl`, `jq`, and valid credentials.

## Frontend + Canvas

See `interviewlab-frontend/docs/LOCAL_DEMO.md` for the browser demo.

- **Socket.IO** (canvas): same port — topology events from Component 2  
- **WebSocket** `GET upgrade /ws?sessionId=&token=`: binary PCM → Component 5 → `metrics:update` JSON  
