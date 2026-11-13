# InterviewLab — local deployment runbook

Use this document as the **single source of truth** for running the integrated demo on a developer machine. It is written so a person can follow it top-to-bottom, or an **LLM / coding agent** can execute it step-by-step with verification after each step.

**Related:** [INTEGRATION.md](./INTEGRATION.md) (API flow), [FULL_DEMO_SETUP.md](./FULL_DEMO_SETUP.md) (short overview), `interviewlab-frontend/docs/LOCAL_DEMO.md` (browser happy path).

---

## For automation agents (read first)

| Rule | Detail |
|------|--------|
| Order | Run steps **sequentially**. Do not start dependent services before prerequisites pass `VERIFY`. |
| Branch | `integration/demo` on **all** repos below. |
| Layout | All repos are **sibling directories** under one parent folder `INTERVIEWLAB_ROOT`. |
| Secrets | Never commit `.env` files. Copy from `.env.example` only. |
| Ports | Do not change ports unless every env file and frontend `.env.local` is updated together. |
| Stop condition | After **Step 12**, all health checks must return HTTP 200 and `demo-spine.sh` must exit 0. |

### Constants (substitute paths)

```text
INTERVIEWLAB_ROOT     = parent folder containing all repos (example: $HOME/src/interviewlab)
GIT_ORG               = intervulab
GIT_BRANCH            = integration/demo

PORT_FRONTEND         = 3000
PORT_CANVAS           = 3001
PORT_BACKEND          = 4000
PORT_POSTGRES         = 5432
PORT_AGENT            = 8000
PORT_ML               = 8001

HEALTH_BACKEND        = http://localhost:4000/health
HEALTH_AGENT          = http://localhost:8000/health
HEALTH_ML             = http://localhost:8001/health
HEALTH_FRONTEND       = http://localhost:3000
```

### Repositories to clone (siblings under `INTERVIEWLAB_ROOT`)

| Dir name | GitHub repo | Role |
|----------|-------------|------|
| `backend` | `backend` | C3 gateway (Node) |
| `interviewlab-frontend` | `interviewlab-frontend` | C1 UI |
| `interviewlab-system-canvas` | `interviewlab-system-canvas` | C2 canvas |
| `interviewlab-agent-orchestrator` | `interviewlab-agent-orchestrator` | C4 agents |
| `intervulab` | `interviewlab-ml` | C5 ML |

Clone pattern (repeat for each repo):

```bash
git clone -b integration/demo "https://github.com/intervulab/REPO_NAME.git" "$INTERVIEWLAB_ROOT/DIR_NAME"
```

---

## Choose a deployment path

| Path | When to use |
|------|-------------|
| **A — Docker Postgres + host Node/Python** | Default for new teammates (Docker for DB + C4/C5 containers optional). |
| **B — One-shot shell script** | Same as A but services started via `scripts/run-full-demo.sh` (needs pre-built venvs). |
| **C — Fully manual terminals** | Debugging one component at a time. |

Steps **0–4** are common. Then follow **Path A**, **B**, or **C**.

---

## Step 0 — Tooling prerequisites

**Goal:** Required CLIs are available.

**Commands (Linux):**

```bash
command -v git && command -v node && command -v npm && command -v python3 && command -v curl && command -v jq
```

Optional for Path A: `docker` and `docker compose`.

**VERIFY:** Each `command -v` prints a path; `node -v` should be v18+ (v20 recommended); `python3 --version` should be 3.11+.

**On failure:** Install Node 20, Python 3.12, `jq`, `curl`. For Docker path install Docker Engine + Compose plugin.

---

## Step 1 — Clone repositories

**Goal:** Five sibling repos on branch `integration/demo`.

**Commands:**

```bash
export INTERVIEWLAB_ROOT="${INTERVIEWLAB_ROOT:-$HOME/interviewlab}"
mkdir -p "$INTERVIEWLAB_ROOT"
cd "$INTERVIEWLAB_ROOT"

for spec in \
  "backend:backend" \
  "interviewlab-frontend:interviewlab-frontend" \
  "interviewlab-system-canvas:interviewlab-system-canvas" \
  "interviewlab-agent-orchestrator:interviewlab-agent-orchestrator" \
  "intervulab:interviewlab-ml"; do
  dir="${spec%%:*}"
  repo="${spec##*:}"
  if [[ ! -d "$dir/.git" ]]; then
    git clone -b integration/demo "https://github.com/intervulab/${repo}.git" "$dir"
  else
    git -C "$dir" fetch origin && git -C "$dir" checkout integration/demo && git -C "$dir" pull --ff-only
  fi
done
```

**VERIFY:**

```bash
ls -d "$INTERVIEWLAB_ROOT"/*/package.json "$INTERVIEWLAB_ROOT"/*/requirements.txt 2>/dev/null | wc -l
# Expect at least 3 (backend, frontend, canvas package.json; python requirements in agent + intervulab)
```

---

## Step 2 — Environment files

**Goal:** Local env templates copied; integration URLs point at localhost.

**Commands:**

```bash
cd "$INTERVIEWLAB_ROOT"

# C3
cp -n backend/.env.example backend/.env

# C1
cp -n interviewlab-frontend/.env.example interviewlab-frontend/.env.local

# C4 (required for live LLM questions)
cp -n interviewlab-agent-orchestrator/.env.example interviewlab-agent-orchestrator/.env
```

Edit `interviewlab-agent-orchestrator/.env` and set **`GROQ_API_KEY`** (see `.env.example` on `integration/demo`). Without it, C3 falls back to a **single default question** but the stack still runs; C5 rubric/ STT still work.

**VERIFY:** Files exist:

```bash
test -f backend/.env && test -f interviewlab-frontend/.env.local && test -f interviewlab-agent-orchestrator/.env
grep -q 'AGENT_SERVICE_URL.*8000' backend/.env
grep -q 'ML_SERVICE_URL.*8001' backend/.env
```

---

## Step 3 — Python virtual environments (C4 + C5)

**Goal:** Isolated venvs with pinned dependencies (including `httpx==0.27.2` for C4).

**Commands (using `uv` — or use `python3 -m venv` + `pip install -r requirements.txt`):**

```bash
cd "$INTERVIEWLAB_ROOT"

# Example with python3 -m venv:
python3 -m venv .venv-agent
.venv-agent/bin/pip install -r interviewlab-agent-orchestrator/requirements.txt

python3 -m venv .venv-ml
.venv-ml/bin/pip install -r intervulab/requirements.txt
```

If using the project’s helper paths from `run-full-demo.sh`, venvs may live at `$INTERVIEWLAB_ROOT/.venv-agent` and `$INTERVIEWLAB_ROOT/.venv-ml`.

**VERIFY:**

```bash
.venv-agent/bin/python -c "import httpx; assert httpx.__version__.startswith('0.27')"
.venv-ml/bin/python -c "import fastapi"
```

---

## Step 4 — Node dependencies (C1, C2, C3)

**Goal:** `node_modules` installed for all JS apps.

**Commands:**

```bash
cd "$INTERVIEWLAB_ROOT"
for dir in backend interviewlab-frontend interviewlab-system-canvas; do
  (cd "$dir" && npm install)
done
```

**VERIFY:** `test -d backend/node_modules && test -d interviewlab-frontend/node_modules`

---

# Path A — Docker Postgres (+ optional C4/C5 containers)

## Step A5 — Start Docker stack

**Goal:** Postgres listening on 5432; optionally C4/C5 in Docker.

**Commands:**

```bash
cd "$INTERVIEWLAB_ROOT/backend"
docker compose -f docker-compose.integration.yml up -d
```

`docker-compose.integration.yml` expects sibling paths `../interviewlab-agent-orchestrator` and `../intervulab` for image builds and uses `../interviewlab-agent-orchestrator/.env` for the agent.

**Alternative (Postgres only):** comment out `agent-orchestrator` and `ml-analytics` in the compose file, or run:

```bash
docker compose -f docker-compose.integration.yml up -d postgres
```

Then start C4/C5 on the host in Step A6.

**VERIFY:**

```bash
docker compose -f docker-compose.integration.yml ps
nc -z localhost 5432 && echo "postgres ok"
curl -sf http://localhost:8000/health && echo "agent ok" || true
curl -sf http://localhost:8001/health && echo "ml ok" || true
```

---

## Step A6 — Database migrations (C3)

**Goal:** Prisma schema applied to Postgres.

**Commands:**

```bash
cd "$INTERVIEWLAB_ROOT/backend"
npx prisma migrate deploy
```

**VERIFY:** Command exits 0; backend can connect (next step).

---

## Step A7 — Start services on host (if not using Docker for C4/C5)

**Goal:** All five user-facing processes running.

Run **each block in its own terminal** (or background with logs):

```bash
# C4 — must cd into agent repo so .env loads
cd "$INTERVIEWLAB_ROOT/interviewlab-agent-orchestrator"
"$INTERVIEWLAB_ROOT/.venv-agent/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8000

# C5
"$INTERVIEWLAB_ROOT/.venv-ml/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8001 \
  --app-dir "$INTERVIEWLAB_ROOT/intervulab"

# C3
cd "$INTERVIEWLAB_ROOT/backend"
npm run dev

# C1
cd "$INTERVIEWLAB_ROOT/interviewlab-frontend"
npm run dev

# C2 (optional but needed for System Design iframe)
cd "$INTERVIEWLAB_ROOT/interviewlab-system-canvas"
npm run dev
```

**VERIFY:**

```bash
curl -sf http://localhost:8000/health | jq .status
curl -sf http://localhost:8001/health | jq .status
curl -sf http://localhost:4000/health | jq .status
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001
```

Expected: `healthy` or `UP` / HTTP `200`.

**After changing C4 `.env`:** restart only the process on port **8000**.

---

# Path B — One-shot script (recommended)

## Step B5 — `dev-local.sh` (one command)

**Goal:** Same end state as Path A: preflight → Postgres → C5 → C4 → C3 → C1 → C2 → status table.

**Prerequisites:** Steps 0–4 complete once (venvs at `$INTERVIEWLAB_ROOT/.venv-agent` and `.venv-ml`, `npm install` in Node repos).

**Commands:**

```bash
export INTERVIEWLAB_ROOT=~/Repos   # parent of backend/, intervulab/, etc.
chmod +x "$INTERVIEWLAB_ROOT/interviewlab-dev.sh" "$INTERVIEWLAB_ROOT/backend/scripts/dev-local.sh"
"$INTERVIEWLAB_ROOT/interviewlab-dev.sh"
```

**Other commands:**

```bash
./interviewlab-dev.sh stop      # stop stack
./interviewlab-dev.sh status    # ports / health
./interviewlab-dev.sh restart
```

Logs: `$INTERVIEWLAB_ROOT/logs/` · PIDs: `$INTERVIEWLAB_ROOT/logs/pids/`

Legacy alias: `backend/scripts/run-full-demo.sh` (calls `dev-local.sh`).

**VERIFY:** Same health URLs as Step A7.

**Note:** First session page load may request **microphone** permission for live analytics (WebSocket → C5).

---

# Path C — Manual reference

Same commands as **Step A7**, in any order after Postgres + migrations, with dependency order:

1. Postgres (Docker or `node backend/scripts/start-embedded-postgres.mjs`)
2. C4 (8000), C5 (8001)
3. C3 (4000)
4. C1 (3000), C2 (3001)

---

## Step 12 — Automated acceptance test

**Goal:** Prove REST integration without the browser.

**Commands:**

```bash
cd "$INTERVIEWLAB_ROOT/backend"
chmod +x scripts/demo-spine.sh
./scripts/demo-spine.sh
```

**VERIFY:** Final line `==> Spine OK`.

**On failure:**

| Symptom | Likely fix |
|---------|------------|
| Register 5xx | Postgres down or migrations not applied |
| Session created but odd questions | C4 down or OpenAI quota — check `curl localhost:8000/health` and agent logs |
| Answer 5xx | C5 down — `curl localhost:8001/health` |
| `jq` / `curl` errors | Install `jq`; ensure `API_BASE` defaults to `http://localhost:4000/api/v1` |

---

## Step 13 — Browser happy path (human)

1. Open http://localhost:3000/register — create a user.
2. **Practice** → **Initialize Session** → land on `/session/{id}` (not a global error page).
3. Type or record an answer → **Submit answer**.
4. **System Design** (canvas tab) if C2 is up.
5. **End & Report**.

Allow microphone when prompted on the session page.

---

## Operational cheat sheet

| Action | Command |
|--------|---------|
| Restart agent after API key change | Kill PID on 8000, restart uvicorn from `interviewlab-agent-orchestrator/` |
| Smoke test API only | `backend/scripts/demo-spine.sh` |
| Integration API map | `backend/docs/INTEGRATION.md` |
| OpenAPI | http://localhost:8000/docs , http://localhost:8001/docs |

---

## Known limitations (integration/demo branch)

- Live multi-agent questions require **OpenAI credits** on the key in C4 `.env`.
- If C4 `POST /interview/start` fails, C3 stores **fallback** DB questions; UI should still work.
- Embedded Postgres data lives in `backend/.pgdata/` (gitignored); do not commit.
- `run-full-demo.sh` assumes a Linux layout; on macOS use Path A/C and Docker Desktop.

---

## Quick prompt for an LLM

Copy everything below into a new agent chat:

```text
Deploy InterviewLab locally using the runbook at:
  backend/docs/LOCAL_DEPLOYMENT.md (branch integration/demo)

Set INTERVIEWLAB_ROOT to: <YOUR_PARENT_FOLDER>

Follow steps 0–4, then Path A (Docker) unless I say otherwise.
After each step, run the VERIFY commands and stop if any fail.
Do not commit or print secrets from .env files.
Finish with ./backend/scripts/demo-spine.sh and report health check URLs.
```
