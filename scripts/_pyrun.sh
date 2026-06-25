#!/usr/bin/env bash
# Cross-platform Python launcher for AI log hooks.
if command -v python3 >/dev/null 2>&1; then
  exec python3 "$@"
elif command -v python >/dev/null 2>&1; then
  exec python "$@"
elif command -v py >/dev/null 2>&1; then
  exec py -3 "$@"
fi
echo "[pyrun] No Python found on PATH" >&2
exit 1
