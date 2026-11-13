# Shared paths and helpers for InterviewLab local dev scripts.
# shellcheck shell=bash

dev_common_init() {
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  BACKEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
  ROOT="${INTERVIEWLAB_ROOT:-$(cd "$BACKEND_DIR/.." && pwd)}"

  LOG_DIR="$ROOT/logs"
  PID_DIR="$LOG_DIR/pids"
  mkdir -p "$LOG_DIR" "$PID_DIR"

  NODE_BIN="${INTERVIEWLAB_NODE:-}"
  if [[ -z "$NODE_BIN" ]]; then
    if [[ -x "$ROOT/node-v20.18.0-linux-x64/bin/node" ]]; then
      NODE_BIN="$ROOT/node-v20.18.0-linux-x64/bin"
    else
      NODE_BIN="$(dirname "$(command -v node 2>/dev/null || echo /usr/bin/node)")"
    fi
  fi
  export PATH="$NODE_BIN:$PATH"

  VENV_AGENT="$ROOT/.venv-agent"
  VENV_ML="$ROOT/.venv-ml"

  REPO_BACKEND="$ROOT/backend"
  REPO_FRONTEND="$ROOT/interviewlab-frontend"
  REPO_CANVAS="$ROOT/interviewlab-system-canvas"
  REPO_AGENT="$ROOT/interviewlab-agent-orchestrator"
  REPO_ML="$ROOT/intervulab"
}

log() { printf '%s\n' "$*"; }
warn() { printf '⚠️  %s\n' "$*" >&2; }
die() { printf '❌ %s\n' "$*" >&2; exit 1; }

port_open() {
  local port="$1"
  if command -v nc >/dev/null 2>&1; then
    nc -z localhost "$port" 2>/dev/null
  else
    ss -tln 2>/dev/null | grep -q ":${port} "
  fi
}

# True if any InterviewLab service port is listening (stack likely running).
stack_listening() {
  local port
  for port in 3000 3001 4000 5432 8000 8001; do
    if port_open "$port"; then
      return 0
    fi
  done
  return 1
}

http_ok() {
  curl -sf --max-time 3 "$1" >/dev/null 2>&1
}

save_pid() {
  local name="$1"
  local pid="$2"
  echo "$pid" >"$PID_DIR/${name}.pid"
}

read_pid() {
  local name="$1"
  local f="$PID_DIR/${name}.pid"
  [[ -f "$f" ]] && cat "$f"
}

is_alive() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

wait_for_http() {
  local url="$1"
  local tries="${2:-45}"
  local i=0
  while (( i < tries )); do
    if http_ok "$url"; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

start_if_down() {
  local name="$1"
  local health_url="$2"
  local log_file="$3"
  shift 3

  if http_ok "$health_url"; then
    log "  $name already up ($health_url)"
    return 0
  fi

  local old_pid
  old_pid="$(read_pid "$name" || true)"
  if is_alive "$old_pid"; then
    log "  $name process $old_pid running but unhealthy — stopping"
    kill "$old_pid" 2>/dev/null || true
    sleep 1
  fi

  log "  Starting $name…"
  "$@" >>"$log_file" 2>&1 &
  local pid=$!
  save_pid "$name" "$pid"

  if wait_for_http "$health_url" 60; then
    log "  $name ready (pid $pid)"
  else
    warn "$name did not become healthy in time — see $log_file"
    return 0
  fi
}
