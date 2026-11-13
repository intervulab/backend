#!/usr/bin/env bash
# Start demo/presentation stack, wait for UI, open in Google Chrome (Flatpak or native).
set -euo pipefail

ROOT="${INTERVIEWLAB_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
export INTERVIEWLAB_ROOT="$ROOT"
URL="${INTERVIEWLAB_URL:-http://localhost:3000}"

LOG="$ROOT/logs/presentation-launch.log"
mkdir -p "$ROOT/logs"

{
  echo "=== $(date -Is) presentation launch (start if needed, open browser) ==="
  "$ROOT/backend/scripts/presentation.sh" start
} >>"$LOG" 2>&1

for _ in $(seq 1 90); do
  if curl -sf --max-time 2 "$URL" >/dev/null 2>&1 \
    && curl -sf --max-time 2 "http://localhost:4000/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

open_interviewlab_in_browser() {
  local url="$1"

  if [[ -n "${INTERVIEWLAB_BROWSER:-}" && -x "${INTERVIEWLAB_BROWSER}" ]]; then
    exec "${INTERVIEWLAB_BROWSER}" "$url"
  fi

  if command -v google-chrome-stable >/dev/null 2>&1; then
    exec google-chrome-stable "$url"
  fi
  if command -v google-chrome >/dev/null 2>&1; then
    exec google-chrome "$url"
  fi
  if flatpak info com.google.Chrome >/dev/null 2>&1; then
    exec flatpak run com.google.Chrome "$url"
  fi
  if [[ -x /usr/bin/brave-browser ]]; then
    exec /usr/bin/brave-browser "$url"
  fi
  if command -v xdg-open >/dev/null; then
    exec xdg-open "$url"
  fi

  echo "InterviewLab is up at $url (install Chrome or set INTERVIEWLAB_BROWSER)"
}

open_interviewlab_in_browser "$URL"
