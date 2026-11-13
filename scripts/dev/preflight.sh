#!/usr/bin/env bash
# One-time / idempotent checks before starting InterviewLab locally.
set -euo pipefail

_HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_common.sh
source "$_HERE/_common.sh"
dev_common_init

log "== Preflight (INTERVIEWLAB_ROOT=$ROOT) =="

[[ -d "$REPO_BACKEND" ]] || die "Missing backend at $REPO_BACKEND"
[[ -d "$REPO_FRONTEND" ]] || die "Missing interviewlab-frontend at $REPO_FRONTEND"
[[ -d "$REPO_ML" ]] || die "Missing intervulab (C5) at $REPO_ML"
[[ -d "$REPO_AGENT" ]] || die "Missing interviewlab-agent-orchestrator at $REPO_AGENT"

command -v curl >/dev/null || die "curl is required"
command -v node >/dev/null || die "node is required (set INTERVIEWLAB_NODE if needed)"

[[ -x "$VENV_AGENT/bin/uvicorn" ]] || warn "Missing $VENV_AGENT — create venv and pip install -r interviewlab-agent-orchestrator/requirements.txt"
[[ -x "$VENV_ML/bin/uvicorn" ]] || warn "Missing $VENV_ML — create venv and pip install -r intervulab/requirements.txt"

if [[ ! -f "$REPO_BACKEND/.env" ]]; then
  cp "$REPO_BACKEND/.env.example" "$REPO_BACKEND/.env"
  log "  Created backend/.env from example"
fi
# Embedded Postgres uses database `postgres` (see start-embedded-postgres.mjs)
if grep -q 'ai_interview_db' "$REPO_BACKEND/.env" 2>/dev/null; then
  sed -i.bak 's|ai_interview_db|postgres|g' "$REPO_BACKEND/.env" 2>/dev/null || \
    sed -i '' 's|ai_interview_db|postgres|g' "$REPO_BACKEND/.env" 2>/dev/null || true
  rm -f "$REPO_BACKEND/.env.bak"
fi

if [[ ! -f "$REPO_FRONTEND/.env.local" ]]; then
  if [[ -f "$REPO_FRONTEND/.env.example" ]]; then
    cp "$REPO_FRONTEND/.env.example" "$REPO_FRONTEND/.env.local"
    log "  Created interviewlab-frontend/.env.local"
  fi
fi

if [[ ! -f "$REPO_AGENT/.env" ]]; then
  cp "$REPO_AGENT/.env.example" "$REPO_AGENT/.env"
  log "  Created interviewlab-agent-orchestrator/.env"
fi

if ! grep -qE '^GROQ_API_KEY=gsk_' "$REPO_AGENT/.env" 2>/dev/null; then
  warn "Set GROQ_API_KEY in interviewlab-agent-orchestrator/.env (see .env.example) — OpenAI vars are ignored on current C4."
fi

if ! "$VENV_ML/bin/python" -c "import faster_whisper" 2>/dev/null; then
  warn "C5 local STT not installed — pip install -r intervulab/requirements-stt.txt in .venv-ml for voice transcripts offline."
fi

if port_open 5432; then
  log "  Prisma migrate deploy…"
  (
    cd "$REPO_BACKEND"
    npx prisma generate >/dev/null 2>&1 || true
    npx prisma migrate deploy >>"$LOG_DIR/prisma.log" 2>&1
  ) || warn "Prisma migrate failed — see $LOG_DIR/prisma.log"
else
  log "  Postgres not up yet — migrations run after DB starts"
fi

log "== Preflight done =="
