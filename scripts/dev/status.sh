#!/usr/bin/env bash
set -euo pipefail

_HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "$_HERE/_common.sh"
dev_common_init

log "== InterviewLab status (root: $ROOT) =="
log ""
printf "%-12s %-8s %-8s %s\n" "SERVICE" "PORT" "PID" "HEALTH"

check() {
  local label="$1" port="$2" url="$3" pid_name="$4"
  local pid status="down"
  pid="$(read_pid "$pid_name" || true)"
  if http_ok "$url" 2>/dev/null || curl -s -o /dev/null -w "" --max-time 2 "$url" 2>/dev/null; then
    status="up"
  fi
  printf "%-12s %-8s %-8s %s\n" "$label" "$port" "${pid:--}" "$status"
}

check "Frontend" 3000 "http://127.0.0.1:3000" "frontend"
check "Canvas" 3001 "http://127.0.0.1:3001" "canvas"
check "Backend" 4000 "http://127.0.0.1:4000/health" "backend"
check "Agent C4" 8000 "http://127.0.0.1:8000/health" "agent"
check "ML C5" 8001 "http://127.0.0.1:8001/health" "ml"
if port_open 5432; then pgst="up"; else pgst="down"; fi
printf "%-12s %-8s %-8s %s\n" "Postgres" 5432 "$(read_pid postgres || echo '-')" "$pgst"

log ""
log "App:    http://localhost:3000"
log "API:    http://localhost:4000/api/v1"
log "Logs:   $LOG_DIR/"
log "Stop:   $REPO_BACKEND/scripts/dev-local.sh stop"
