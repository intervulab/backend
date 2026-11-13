#!/usr/bin/env bash
# One command to run InterviewLab locally:
#   ./backend/scripts/dev-local.sh          # preflight + start + status
#   ./backend/scripts/dev-local.sh stop
#   ./backend/scripts/dev-local.sh status
#
# From anywhere, with sibling repos under INTERVIEWLAB_ROOT (default: parent of backend/).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEV_DIR="$SCRIPT_DIR/dev"

usage() {
  cat <<'EOF'
InterviewLab local development

Usage:
  dev-local.sh              Start full stack (Postgres, C5, C4, C3, C1, C2)
  dev-local.sh start        Same as default
  dev-local.sh stop         Stop all services
  dev-local.sh status       Show ports / health
  dev-local.sh restart      stop then start

Environment:
  INTERVIEWLAB_ROOT         Parent folder containing backend/, intervulab/, etc.
  INTERVIEWLAB_NODE         Directory containing node binary (optional)

Example:
  export INTERVIEWLAB_ROOT=~/Repos
  ~/Repos/backend/scripts/dev-local.sh
EOF
}

cmd="${1:-start}"
case "$cmd" in
  start | up | "")
    bash "$DEV_DIR/preflight.sh"
    bash "$DEV_DIR/up.sh"
    bash "$DEV_DIR/status.sh"
    ;;
  stop | down)
    bash "$DEV_DIR/down.sh"
    ;;
  status)
    bash "$DEV_DIR/status.sh"
    ;;
  restart)
    bash "$DEV_DIR/down.sh"
    sleep 2
    bash "$DEV_DIR/preflight.sh"
    bash "$DEV_DIR/up.sh"
    bash "$DEV_DIR/status.sh"
    ;;
  -h | --help | help)
    usage
    ;;
  *)
    die "Unknown command: $cmd" 2>/dev/null || { echo "Unknown command: $cmd"; usage; exit 1; }
    ;;
esac
