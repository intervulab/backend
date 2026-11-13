#!/usr/bin/env bash
# Start demo/presentation stack, wait for UI, open default browser (Brave).
set -euo pipefail

ROOT="${INTERVIEWLAB_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
export INTERVIEWLAB_ROOT="$ROOT"
URL="${INTERVIEWLAB_URL:-http://localhost:3000}"
BROWSER="${INTERVIEWLAB_BROWSER:-/usr/bin/brave-browser}"

LOG="$ROOT/logs/presentation-launch.log"
mkdir -p "$ROOT/logs"

{
  echo "=== $(date -Is) presentation launch (stop-if-running, then start) ==="
  "$ROOT/backend/scripts/presentation.sh" start
} >>"$LOG" 2>&1

for _ in $(seq 1 90); do
  if curl -sf --max-time 2 "$URL" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if [[ -x "$BROWSER" ]]; then
  exec "$BROWSER" "$URL"
elif command -v xdg-open >/dev/null; then
  exec xdg-open "$URL"
else
  echo "InterviewLab is up at $URL (install Brave or set INTERVIEWLAB_BROWSER)"
fi
