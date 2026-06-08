#!/usr/bin/env python3
"""
Fallback AI log generator — creates log entries from recent git commit messages.

Called by the pre-push hook ONLY when log_antigravity.py finds no new prompts
(which happens when the Antigravity IDE hasn't flushed its transcript yet).

This ensures every `git push` always produces at least some log data for the
grading server, even during an active conversation session.

Logic:
  1. Read .ai-log/last_push_commit to find the last commit that was logged.
  2. Get all commits between that and HEAD.
  3. For each commit, create a log entry with the commit message as the prompt.
  4. Write entries to .ai-log/session.jsonl (same as other log scripts).
  5. Update .ai-log/last_push_commit with HEAD.
"""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Fix Windows console encoding
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

VN_TZ = timezone(timedelta(hours=7))
LOG_DIR = Path(os.environ.get("AI_LOG_DIR", ".ai-log"))
LOG_FILE = LOG_DIR / "session.jsonl"
LAST_PUSH_FILE = LOG_DIR / "last_push_commit"


def git(cmd: str) -> str:
    try:
        return subprocess.check_output(
            cmd.split(), shell=False, text=True,
            stderr=subprocess.DEVNULL, encoding="utf-8"
        ).strip()
    except Exception:
        return ""


def get_last_push_commit() -> str:
    """Read the last commit hash that was logged."""
    if LAST_PUSH_FILE.exists():
        return LAST_PUSH_FILE.read_text(encoding="utf-8").strip()
    return ""


def save_last_push_commit(commit_hash: str) -> None:
    """Save current HEAD as the last logged commit."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    LAST_PUSH_FILE.write_text(commit_hash + "\n", encoding="utf-8")


def get_logged_entry_ids() -> set:
    """Read existing entry IDs to avoid duplicates."""
    ids = set()
    if not LOG_FILE.exists():
        return ids
    with open(LOG_FILE, encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                eid = entry.get("entry_id", "")
                if eid:
                    ids.add(eid)
            except json.JSONDecodeError:
                pass
    return ids


def get_commits_since(since_commit: str) -> list:
    """Get list of commits since the given commit (exclusive)."""
    if since_commit:
        # Verify the commit exists
        check = git(f"git cat-file -t {since_commit}")
        if check != "commit":
            since_commit = ""

    if since_commit:
        log_range = f"{since_commit}..HEAD"
    else:
        # First run: get commits from last 24 hours
        log_range = "--since=24.hours HEAD"

    raw = git(
        f"git log {log_range} --format=%H||%aI||%s --no-merges"
    )
    if not raw:
        return []

    commits = []
    for line in raw.strip().split("\n"):
        parts = line.split("||", 2)
        if len(parts) == 3:
            commits.append({
                "hash": parts[0],
                "timestamp": parts[1],
                "message": parts[2],
            })
    return commits


def main():
    # Check if log_antigravity.py already logged something in this run.
    # We only act as a fallback.
    if LOG_FILE.exists() and LOG_FILE.stat().st_size > 0:
        print("[commit-log] session.jsonl already has entries, skipping fallback.",
              file=sys.stderr)
        # Still update last_push_commit
        head = git("git rev-parse HEAD")
        if head:
            save_last_push_commit(head)
        sys.exit(0)

    last_commit = get_last_push_commit()
    head = git("git rev-parse HEAD")

    if not head:
        print("[commit-log] Not in a git repo.", file=sys.stderr)
        sys.exit(0)

    if last_commit == head:
        print("[commit-log] No new commits since last push.", file=sys.stderr)
        sys.exit(0)

    commits = get_commits_since(last_commit)
    if not commits:
        print("[commit-log] No commits found to log.", file=sys.stderr)
        save_last_push_commit(head)
        sys.exit(0)

    # Build log entries
    repo = git("git remote get-url origin").split("/")[-1].replace(".git", "")
    branch = git("git rev-parse --abbrev-ref HEAD")
    student = git("git config user.email") or os.environ.get(
        "USERNAME", os.environ.get("USER", "unknown"))
    logged_ids = get_logged_entry_ids()

    entries = []
    for c in commits:
        entry_id = f"commit-{c['hash'][:12]}"
        if entry_id in logged_ids:
            continue

        ts = c["timestamp"]
        try:
            dt = datetime.fromisoformat(ts)
            ts = dt.astimezone(VN_TZ).isoformat()
        except ValueError:
            ts = datetime.now(VN_TZ).isoformat()

        entries.append({
            "ts": ts,
            "tool": "antigravity",
            "event": "UserPrompt",
            "entry_id": entry_id,
            "session_id": f"commit-fallback-{branch}",
            "model": "gemini",
            "repo": repo or Path.cwd().name,
            "branch": branch,
            "commit": c["hash"][:7],
            "student": student,
            "prompt": f"[commit] {c['message']}",
            "response_summary": "",
        })

    if not entries:
        print("[commit-log] All commits already logged.", file=sys.stderr)
        save_last_push_commit(head)
        sys.exit(0)

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

    print(f"[commit-log] Logged {len(entries)} commit(s) as fallback.",
          file=sys.stderr)
    save_last_push_commit(head)


if __name__ == "__main__":
    main()
