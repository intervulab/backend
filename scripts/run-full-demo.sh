#!/usr/bin/env bash
# InterviewLab full local stack (real C4/C5 FastAPI, embedded or Docker Postgres)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Expect sibling repos: backend, interviewlab-frontend, intervulab, etc.
ROOT="${INTERVIEWLAB_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
NODE="${INTERVIEWLAB_NODE:-$ROOT/node-v20.18.0-linux-x64/bin}"
UV="${INTERVIEWLAB_UV:-$ROOT/uv-x86_64-unknown-linux-gnu/uv}"
export PATH="$NODE:$PATH"

mkdir -p "$ROOT/logs"

if ! nc -z localhost 5432 2>/dev/null; then
  echo "Starting embedded Postgres…"
  node "$ROOT/backend/scripts/start-embedded-postgres.mjs" >> "$ROOT/logs/postgres.log" 2>&1 &
  sleep 3
fi

if [[ ! -f "$ROOT/backend/.env" ]]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  sed -i 's|ai_interview_db|postgres|' "$ROOT/backend/.env" 2>/dev/null || true
fi

cd "$ROOT/backend"
npx prisma migrate deploy >> "$ROOT/logs/prisma.log" 2>&1 || true

if [[ ! -f "$ROOT/interviewlab-agent-orchestrator/.env" ]]; then
  cp "$ROOT/interviewlab-agent-orchestrator/.env.example" "$ROOT/interviewlab-agent-orchestrator/.env"
  echo "⚠️  Add OPENAI_API_KEY to interviewlab-agent-orchestrator/.env for live AI questions."
fi

if ! curl -sf http://localhost:8001/health >/dev/null; then
  echo "Starting ML (C5)…"
  "$ROOT/.venv-ml/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8001 \
    --app-dir "$ROOT/intervulab" >> "$ROOT/logs/ml.log" 2>&1 &
fi

if ! curl -sf http://localhost:8000/health >/dev/null; then
  echo "Starting Agent (C4)…"
  cd "$ROOT/interviewlab-agent-orchestrator"
  "$ROOT/.venv-agent/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8000 >> "$ROOT/logs/agent.log" 2>&1 &
fi

sleep 2

if ! curl -sf http://localhost:4000/health >/dev/null; then
  echo "Starting Backend (C3)…"
  cd "$ROOT/backend"
  npm run dev >> "$ROOT/logs/backend.log" 2>&1 &
fi

if ! curl -sf http://localhost:3000 >/dev/null; then
  echo "Starting Frontend (C1)…"
  cd "$ROOT/interviewlab-frontend"
  [[ -f .env.local ]] || cp .env.example .env.local 2>/dev/null || true
  npm run dev >> "$ROOT/logs/frontend.log" 2>&1 &
fi

if ! curl -sf http://localhost:3001 >/dev/null; then
  echo "Starting Canvas (C2)…"
  cd "$ROOT/interviewlab-system-canvas"
  npm run dev >> "$ROOT/logs/canvas.log" 2>&1 &
fi

sleep 4
echo ""
echo "== Health =="
for url in http://localhost:8001/health http://localhost:8000/health http://localhost:4000/health http://localhost:3000; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "down")
  echo "$url → $code"
done
echo ""
echo "Open http://localhost:3000 — register → Practice → session"
echo "Logs: $ROOT/logs/"
