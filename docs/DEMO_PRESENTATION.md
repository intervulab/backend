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

Start: `$INTERVIEWLAB_ROOT/interviewlab-dev.sh` (or `backend/scripts/dev-local.sh`).

Secrets (not in git): `GROQ_API_KEY` in C4 `.env`; optional STT via `intervulab/requirements-stt.txt` in `.venv-ml`.
