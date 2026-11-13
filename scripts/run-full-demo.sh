#!/usr/bin/env bash
# Back-compat wrapper — use dev-local.sh instead.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/dev-local.sh" "${1:-start}"
