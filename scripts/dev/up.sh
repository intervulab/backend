#!/usr/bin/env bash
# Start full InterviewLab stack on localhost (background processes + pid files).
set -euo pipefail

_HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "$_HERE/_common.sh"
dev_common_init

log "== Starting InterviewLab services =="

if ! port_open 5432; then
  log "  Starting embedded Postgres on 5432…"
  node "$REPO_BACKEND/scripts/start-embedded-postgres.mjs" >>"$LOG_DIR/postgres.log" 2>&1 &
  save_pid "postgres" "$!"
  for _ in $(seq 1 30); do
    port_open 5432 && break
    sleep 1
  done
  port_open 5432 || die "Postgres did not open port 5432 — see $LOG_DIR/postgres.log"
else
  log "  Postgres already listening on 5432"
fi

(
  cd "$REPO_BACKEND"
  npx prisma migrate deploy >>"$LOG_DIR/prisma.log" 2>&1 || true
)

start_if_down "ml" "http://127.0.0.1:8001/health" "$LOG_DIR/ml.log" \
  "$VENV_ML/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8001 \
  --app-dir "$REPO_ML"

start_if_down "agent" "http://127.0.0.1:8000/health" "$LOG_DIR/agent.log" \
  bash -c "cd \"$REPO_AGENT\" && exec \"$VENV_AGENT/bin/uvicorn\" app.main:app --host 127.0.0.1 --port 8000"

sleep 1

start_if_down "backend" "http://127.0.0.1:4000/health" "$LOG_DIR/backend.log" \
  bash -c "cd \"$REPO_BACKEND\" && exec npm run dev"

start_if_down "frontend" "http://127.0.0.1:3000" "$LOG_DIR/frontend.log" \
  bash -c "cd \"$REPO_FRONTEND\" && exec npm run dev"

if [[ -d "$REPO_CANVAS" ]]; then
  start_if_down "canvas" "http://127.0.0.1:3001" "$LOG_DIR/canvas.log" \
    bash -c "cd \"$REPO_CANVAS\" && exec npm run dev"
fi

log "== Start complete =="
