# `demo/presentation` branch set

Use the **same branch name** in all five repos for a frozen demo stack:

| Repo | Role |
|------|------|
| `intervulab` | C5 ML |
| `backend` | C3 gateway |
| `interviewlab-frontend` | C1 UI |
| `interviewlab-system-canvas` | C2 canvas |
| `interviewlab-agent-orchestrator` | C4 agents |

```bash
export INTERVIEWLAB_ROOT=~/Repos   # parent of backend/, intervulab/, etc.
for d in intervulab backend interviewlab-frontend interviewlab-system-canvas interviewlab-agent-orchestrator; do
  git -C "$INTERVIEWLAB_ROOT/$d" fetch origin demo/presentation
  git -C "$INTERVIEWLAB_ROOT/$d" checkout demo/presentation
done
```

Start:

- **Desktop / taskbar:** `InterviewLab` app (runs `scripts/presentation-launch.sh` → Chrome). If the stack is already healthy, the launcher **opens the browser only** (no restart).
- **Terminal:** `$INTERVIEWLAB_ROOT/backend/scripts/presentation.sh` or `backend/scripts/dev-local.sh`.
- Full recycle: `INTERVIEWLAB_FORCE_RESTART=1 backend/scripts/presentation.sh start`

Demo flow:

1. Launch once; log in (or register) before Practice.
2. Practice → **Initialize Session** — wait on **Starting… (10–30s)**; do not double-click.
3. Do not click the launcher again mid-session (that can kill the DB). Use a fresh tab if you reopened Chrome.

Secrets (not in git): `GROQ_API_KEY` in C4 `.env`; optional STT via `intervulab/requirements-stt.txt` in `.venv-ml`.
