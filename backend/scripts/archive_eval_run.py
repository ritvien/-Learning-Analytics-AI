"""Archive an eval run into an immutable docs/12-Evaluation/runs/ folder.

Builds the run folder convention documented in docs/12-Evaluation/README.md §9:
manifest.json, cases.json, raw-results.json, metrics.json, report.md.

Usage:
    python scripts/archive_eval_run.py --source-dir <dir with agent_eval_results.json> \
        --task H66 --base-url https://eduinsight-backend-jxmm.onrender.com
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# Allow running as script from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.agent.prompts import get_universal_agent_prompt_manifest
from app.config import get_settings

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATASET_PATH = REPO_ROOT / "docs" / "12-Evaluation" / "gate3_test_cases.json"
RUNS_ROOT = REPO_ROOT / "docs" / "12-Evaluation" / "runs"


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=REPO_ROOT, text=True).strip()


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _category_summary(
    test_cases: list[dict[str, Any]], scores: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    category_by_tc = {tc["tc"]: tc.get("category", "unknown") for tc in test_cases}
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for score in scores:
        grouped[category_by_tc.get(score["tc"], "unknown")].append(score)

    summary = []
    for category in sorted(grouped):
        rows = grouped[category]
        tool_scores = [
            r["tool_accuracy"]["score"]
            for r in rows
            if r["tool_accuracy"].get("score") is not None
        ]
        summary.append(
            {
                "category": category,
                "count": len(rows),
                "task_completion_rate": round(
                    _mean([r["task_completion"]["score"] for r in rows]) * 100, 1
                ),
                "tool_accuracy_avg": round(_mean(tool_scores), 4) if tool_scores else None,
                "semantic_avg": round(_mean([r["semantic"]["score"] for r in rows]), 4),
                "grounding_avg": round(_mean([r["grounding"]["score"] for r in rows]), 4),
            }
        )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Archive an eval run folder (README §9)")
    parser.add_argument("--source-dir", required=True, help="Dir with agent_eval_results.json")
    parser.add_argument("--task", default="H66")
    parser.add_argument("--base-url", default="")
    parser.add_argument("--eval-email", default="lecturer@epu.edu.vn")
    parser.add_argument("--coverage-file", default=None, help="Optional coverage artifact to copy")
    parser.add_argument("--notes", action="append", default=[])
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    payload = json.loads((source_dir / "agent_eval_results.json").read_text(encoding="utf-8"))
    test_cases = json.loads(DATASET_PATH.read_text(encoding="utf-8"))

    started_at = payload.get("timestamp") or datetime.now(UTC).isoformat()
    commit_sha = _git("rev-parse", "HEAD")
    short_sha = commit_sha[:8]
    git_dirty = bool(_git("status", "--porcelain"))
    dataset_sha = _sha256_file(DATASET_PATH)
    case_count = payload.get("test_case_count", len(test_cases))

    stamp = datetime.fromisoformat(started_at)
    run_dir = RUNS_ROOT / f"{stamp:%Y-%m-%d-%H%M%S}-{short_sha}"
    run_dir.mkdir(parents=True, exist_ok=False)

    settings = get_settings()
    runtime = {
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "agent_router_model": settings.agent_router_model,
        "agent_core_model": settings.agent_core_model,
        "rag_embedding_model": settings.rag_embedding_model,
        "base_url": args.base_url,
        "eval_email": args.eval_email,
        "evaluator_pricing_model": payload.get("model", ""),
        "langsmith_tracing": settings.langsmith_tracing,
        "langsmith_project": settings.langsmith_project,
    }
    runtime["runtime_config_hash"] = hashlib.sha256(
        json.dumps(runtime, sort_keys=True).encode("utf-8")
    ).hexdigest()

    manifest = {
        "task": args.task,
        "started_at": started_at,
        "commit_sha": commit_sha,
        "commit_short_sha": short_sha,
        "git_dirty": git_dirty,
        "dataset_version": f"gate3-h61-{case_count}-{dataset_sha[:12]}",
        "eval_set_version": f"h61-expanded-{case_count}",
        "test_cases_path": str(DATASET_PATH.relative_to(REPO_ROOT)),
        "test_cases_sha256": dataset_sha,
        "test_case_count": case_count,
        "prompt_versions": get_universal_agent_prompt_manifest(),
        "runtime": runtime,
        "with_judge": payload.get("with_judge", False),
        "results_source": "api",
        "notes": args.notes,
    }

    metrics = {
        "aggregates": payload["aggregates"],
        "category_summary": _category_summary(test_cases, payload["scores"]),
        "scores": payload["scores"],
    }

    def _dump(name: str, data: Any) -> None:
        (run_dir / name).write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    _dump("cases.json", test_cases)
    _dump("raw-results.json", payload["results"])
    _dump("metrics.json", metrics)
    shutil.copyfile(source_dir / "agent_eval_metrics.md", run_dir / "report.md")
    if args.coverage_file:
        coverage_dest = run_dir / "coverage-out.txt"
        shutil.copyfile(args.coverage_file, coverage_dest)
        manifest["coverage_artifact"] = str(coverage_dest.relative_to(REPO_ROOT))
    _dump("manifest.json", manifest)

    print(f"Archived run to {run_dir}")


if __name__ == "__main__":
    main()
