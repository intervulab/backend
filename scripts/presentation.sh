#!/usr/bin/env bash
# Presentation one-liner: checkout frozen demo branch + start stack.
# From ~/Repos:  ./presentation.sh
set -euo pipefail

ROOT="${INTERVIEWLAB_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
export INTERVIEWLAB_ROOT="$ROOT"
BRANCH="${INTERVIEWLAB_DEMO_BRANCH:-demo/presentation}"

REPOS=(intervulab backend interviewlab-frontend interviewlab-system-canvas interviewlab-agent-orchestrator)
DEV_DIR="$ROOT/backend/scripts/dev"

log() { printf '%s\n' "$*"; }

# shellcheck source=dev/_common.sh
source "$DEV_DIR/_common.sh"
dev_common_init

log "== InterviewLab presentation ($BRANCH) =="

for d in "${REPOS[@]}"; do
  dir="$ROOT/$d"
  [[ -d "$dir/.git" ]] || { echo "Missing $dir"; exit 1; }
  git -C "$dir" fetch origin "$BRANCH" --quiet 2>/dev/null || true
  current="$(git -C "$dir" branch --show-current)"
  if [[ "$current" != "$BRANCH" ]]; then
    log "  checkout $d → $BRANCH"
    git -C "$dir" checkout "$BRANCH"
  fi
  git -C "$dir" pull --ff-only origin "$BRANCH" 2>/dev/null || true
done

cmd="${1:-start}"
case "$cmd" in
  start | up | "")
    force="${INTERVIEWLAB_FORCE_RESTART:-0}"
    if [[ "$force" == "1" ]]; then
      log "INTERVIEWLAB_FORCE_RESTART=1 — recycling stack…"
      bash "$ROOT/backend/scripts/dev-local.sh" stop || true
      sleep 2
      exec "$ROOT/backend/scripts/dev-local.sh" start
    fi
    if stack_listening && http_ok "http://localhost:3000" && http_ok "http://localhost:4000/health"; then
      log "Stack already healthy — skipping restart (set INTERVIEWLAB_FORCE_RESTART=1 to recycle)."
    elif stack_listening; then
      log "Stack unhealthy — stopping, then starting fresh…"
      bash "$ROOT/backend/scripts/dev-local.sh" stop || true
      sleep 2
      exec "$ROOT/backend/scripts/dev-local.sh" start
    else
      exec "$ROOT/backend/scripts/dev-local.sh" start
    fi
    ;;
  *)
    exec "$ROOT/backend/scripts/dev-local.sh" "$cmd"
    ;;
esac
