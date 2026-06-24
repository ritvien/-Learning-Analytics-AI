#!/usr/bin/env bash
# Unified verify for EduInsight (backend + frontend)
# Usage:
#   ./scripts/verify.sh           # full verify
#   ./scripts/verify.sh --quick   # lint only
#   ./scripts/verify.sh --agent-eval  # include slow LLM agent evaluation

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUICK=false
AGENT_EVAL=false

for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=true ;;
    --agent-eval) AGENT_EVAL=true ;;
  esac
done

step() {
  echo ""
  echo "==> $1"
  shift
  "$@"
}

cd "$ROOT"

step "Backend lint (ruff)" bash -c "cd backend && ruff check ."

if [ "$QUICK" = false ]; then
  step "Backend tests (pytest)" bash -c "cd backend && pytest -v"
fi

step "Frontend lint" npm run lint --prefix frontend

if [ "$QUICK" = false ]; then
  step "Frontend tests (vitest)" npm test --prefix frontend
fi

if [ "$AGENT_EVAL" = true ]; then
  if [ -f "$ROOT/backend/scripts/run_evaluation.py" ]; then
    step "Agent evaluation (run_evaluation.py)" bash -c "cd backend && python scripts/run_evaluation.py"
  else
    echo "Warning: backend/scripts/run_evaluation.py not found; skipping agent eval"
  fi
fi

echo ""
echo "All verify steps passed."
