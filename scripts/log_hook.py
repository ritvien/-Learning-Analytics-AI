#!/usr/bin/env python3
"""
Shared AI hook logger — works with Claude Code, Gemini CLI, Codex, Cursor, Copilot.
Reads JSON from stdin, normalizes to common format, appends to .ai-log/session.jsonl

Flags:
  --tool=NAME   Force tool name (claude, copilot, gemini, codex, cursor)
  --debug       Also write raw payload to .ai-log/debug.jsonl for troubleshooting
"""
import json
import os
import sys
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

VN_TZ = timezone(timedelta(hours=7))
DEBUG = "--debug" in sys.argv


def git(cmd: str) -> str:
    try:
        return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def detect_tool(data: dict) -> str:
    """Detect which AI tool sent this hook event.

    Priority:
      1. --tool=NAME CLI argument (cross-platform: cmd.exe, PowerShell, bash)
      2. AI_TOOL_NAME env var (legacy)
      3. Heuristics from payload shape
    """
    for arg in sys.argv[1:]:
        if arg.startswith("--tool="):
            return arg.split("=", 1)[1].lower()
    tool_env = os.environ.get("AI_TOOL_NAME", "").lower()
    if tool_env:
        return tool_env
    # Heuristics
    if "transcript_path" in data and "hook_event_name" in data:
        return "claude"
    if data.get("hook_event_name", "").startswith(("Before", "After", "Session", "Pre", "Notification")):
        return "gemini"
    if data.get("hook_event_name", "")[0:1].islower():
        if "workspace_roots" in data:
            return "cursor"
        if "toolName" in data:
            return "copilot"
    if "hook_event_name" in data:
        return "claude"
    return "unknown"


def _session_id_from_transcript(transcript_path: str) -> str:
    """Extract session UUID from transcript file path.

    Claude Code transcript paths look like:
      ~/.claude/projects/<hash>/<uuid>.jsonl
    The stem is the session UUID.
    """
    if not transcript_path:
        return ""
    stem = Path(transcript_path).stem
    # Only use if it looks like a UUID or a long hash (not a generic name)
    if len(stem) >= 16:
        return stem
    return ""


def normalize(data: dict, tool: str) -> dict | None:
    """Normalize tool-specific payload to a common log entry."""
    event = data.get("hook_event_name") or data.get("event", "")
    ts = datetime.now(VN_TZ).isoformat()

    # Skip entirely when not in a git repo with a remote — entries can't be
    # tied to a team on the server and would clutter the pending queue.
    origin = git("git remote get-url origin")
    if not origin:
        return None
    repo = origin.rstrip("/").split("/")[-1].removesuffix(".git")

    # session_id: explicit field first, then derive from transcript_path
    session_id = (
        data.get("session_id") or
        data.get("conversation_id") or
        data.get("generation_id") or
        _session_id_from_transcript(data.get("transcript_path", ""))
    )

    # model: explicit field first, then env var (Claude Code sets ANTHROPIC_MODEL
    # in subprocess env for hooks in some versions)
    model = (
        data.get("model") or
        os.environ.get("ANTHROPIC_MODEL") or
        os.environ.get("CLAUDE_MODEL") or
        ""
    )

    base: dict = {
        "ts": ts,
        "tool": tool,
        "event": event,
        "session_id": session_id,
        "model": model,
        "repo": repo,
        "branch": git("git rev-parse --abbrev-ref HEAD"),
        "commit": git("git rev-parse --short HEAD"),
        "student": git("git config user.email"),
    }

    # ------------------------------------------------------------------ claude
    if tool == "claude":
        if event == "UserPromptSubmit":
            prompt = data.get("prompt", "")[:1000]
            if not prompt:
                return None  # skip empty-prompt noise
            base["prompt"] = prompt

        elif event == "PostToolUse":
            tool_input = data.get("tool_input")
            # Extract a readable summary from tool_input dict
            summary = ""
            if isinstance(tool_input, dict):
                summary = (
                    tool_input.get("command") or
                    tool_input.get("prompt") or
                    tool_input.get("content") or
                    tool_input.get("file_path") or
                    tool_input.get("pattern") or ""
                )
            base.update({
                "tool_name": data.get("tool_name", ""),
                "tool_input_summary": str(summary)[:300] if summary else None,
                "tool_response_preview": str(data.get("tool_response", ""))[:300] or None,
            })

        elif event == "Stop":
            # Stop event has the richest metadata — backfill model if present
            if data.get("model"):
                base["model"] = data["model"]
            base["stop_reason"] = data.get("stop_reason", "end_turn")

    # ----------------------------------------------------------------- gemini
    elif tool == "gemini":
        if event == "BeforeAgent":
            base["prompt"] = data.get("prompt", "")[:1000]
        else:
            req = data.get("request", {})
            prompt = ""
            for c in reversed(req.get("contents", [])):
                for part in c.get("parts", []):
                    if part.get("text"):
                        prompt = part["text"][:1000]
                        break
                if prompt:
                    break
            answer = ""
            try:
                answer = data["response"]["candidates"][0]["content"]["parts"][0]["text"][:500]
            except Exception:
                pass
            base.update({"prompt": prompt, "response_summary": answer})

    # ------------------------------------------------------------------ codex
    elif tool == "codex":
        base.update({
            "prompt": data.get("prompt", "")[:1000],
            "turn_id": data.get("turn_id", ""),
            "transcript_path": data.get("transcript_path", ""),
        })

    # ----------------------------------------------------------------- cursor
    elif tool == "cursor":
        base.update({
            "prompt": data.get("prompt", "")[:1000],
            "files_context": data.get("attachments", []),
        })

    # ---------------------------------------------------------------- copilot
    elif tool == "copilot":
        base.update({
            "prompt": data.get("prompt", "")[:1000],
            "tool_name": data.get("toolName", ""),
            "tool_args": data.get("toolArgs"),
        })

    # Drop entries with no meaningful payload (tool calls with no summary,
    # lifecycle events we don't care about, etc.)
    _PAYLOAD_KEYS = (
        "prompt", "tool_input_summary", "tool_response_preview",
        "response_summary", "tool_args", "files_context", "stop_reason",
    )
    _LIFECYCLE_EVENTS = ("Stop", "stop", "SessionEnd", "sessionEnd", "AfterModel")
    has_payload = any(base.get(k) for k in _PAYLOAD_KEYS)
    if not has_payload and event not in _LIFECYCLE_EVENTS:
        return None

    return base


def main() -> None:
    # Read stdin as UTF-8 — on Windows the default code page corrupts Vietnamese/CJK.
    raw = sys.stdin.buffer.read().decode("utf-8", errors="replace").strip()
    if not raw:
        sys.exit(0)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(0)

    log_dir = Path(os.environ.get("AI_LOG_DIR", ".ai-log"))
    log_dir.mkdir(exist_ok=True)

    # --debug: dump raw payload so you can inspect what the hook actually receives
    if DEBUG:
        debug_file = log_dir / "debug.jsonl"
        with open(debug_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({
                "ts": datetime.now(VN_TZ).isoformat(),
                "argv": sys.argv,
                "raw": data,
            }, ensure_ascii=False) + "\n")

    tool = detect_tool(data)
    entry = normalize(data, tool)
    if not entry:
        print(json.dumps({"status": "skipped"}))
        sys.exit(0)

    log_file = log_dir / "session.jsonl"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(json.dumps({"status": "logged"}))


if __name__ == "__main__":
    main()
