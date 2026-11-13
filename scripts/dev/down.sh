#!/usr/bin/env bash
# Stop InterviewLab local stack (pid files, then ports).
set -euo pipefail

_HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "$_HERE/_common.sh"
dev_common_init

log "== Stopping InterviewLab services =="

stop_name() {
  local name="$1"
  local pid
  pid="$(read_pid "$name" || true)"
  if is_alive "$pid"; then
    if [[ "$name" == "postgres" ]]; then
      kill -INT "$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    else
      kill "$pid" 2>/dev/null || true
    fi
    log "  Stopped $name (pid $pid)"
  fi
  rm -f "$PID_DIR/${name}.pid"
}

for name in frontend canvas backend agent ml postgres; do
  stop_name "$name"
done

sleep 1

for port in 3000 3001 4000 8000 8001; do
  if port_open "$port"; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
done

if port_open 5432; then
  pkill -INT -f 'start-embedded-postgres.mjs' 2>/dev/null || true
  sleep 1
  fuser -k 5432/tcp 2>/dev/null || true
fi

pkill -f 'nodemon src/server.js' 2>/dev/null || true
pkill -f 'next dev' 2>/dev/null || true
pkill -f 'uvicorn app.main:app' 2>/dev/null || true

sleep 1
log "== Stop complete =="
for port in 3000 3001 4000 5432 8000 8001; do
  if port_open "$port"; then
    warn "Port $port still in use"
  fi
done
