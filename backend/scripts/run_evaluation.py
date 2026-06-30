"""Agent evaluation orchestrator — 6-metric framework + Gate G3 backward compatibility.

Usage:
    python scripts/run_evaluation.py --base-url http://localhost:8000
    python scripts/run_evaluation.py --with-judge   # adds LLM-as-judge (costs tokens)
    python scripts/run_agent_eval_judge.py          # judge-only pass on saved results
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests

# Allow running as script from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.eval.dataset_loader import golden_by_tc, load_golden_answers, load_test_cases
from app.eval.grounding_judge import judge_grounding
from app.eval.scorers import (
    aggregate_latency,
    compute_cost_metrics,
    score_cost,
    score_grounding,
    score_latency,
    score_semantic,
    score_task_completion,
    score_tool_accuracy,
)
from app.eval.semantic_judge import judge_semantic

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "12-Evaluation"
MODEL = "gpt-5.4-nano"


def _parse_sse_line(line: str) -> dict[str, Any] | None:
    """Parse one Server-Sent Events data line from the streaming chat API."""
    stripped = line.strip()
    if not stripped.startswith("data:"):
        return None
    payload = stripped.removeprefix("data:").strip()
    if not payload:
        return None
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _load_local_env(path: Path | str) -> None:
    """Load simple KEY=VALUE pairs from a local .env file without overriding env vars."""
    env_path = Path(path)
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = value.strip().strip('"').strip("'")


def login(base_url: str, email: str, password: str) -> str:
    resp = requests.post(
        f"{base_url}/api/v1/auth/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    logger.info("Logged in as %s", email)
    return token


def run_test_case(base_url: str, token: str, tc: dict[str, Any]) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {"message": tc["input"], "context": {}}

    start = time.perf_counter()
    try:
        resp = requests.post(
            f"{base_url}/api/v1/chat",
            json=payload,
            headers=headers,
            timeout=120,
        )
        elapsed_ms = int((time.perf_counter() - start) * 1000)

        if resp.status_code != 200:
            return {
                "tc": tc["tc"],
                "status": "ERROR",
                "error": f"HTTP {resp.status_code}: {resp.text[:200]}",
                "latency_ms": elapsed_ms,
                "response": "",
                "intent": "",
                "tool_calls": [],
            }

        data = resp.json()
        return {
            "tc": tc["tc"],
            "status": "OK",
            "latency_ms": data.get("latency_ms", elapsed_ms),
            "response": data.get("response", ""),
            "intent": data.get("intent", "unknown"),
            "tool_calls": data.get("tool_calls", []),
            "thread_id": data.get("thread_id"),
            "usage": data.get("usage"),
            "latency_breakdown": data.get("latency_breakdown"),
        }
    except requests.exceptions.Timeout:
        return {
            "tc": tc["tc"],
            "status": "TIMEOUT",
            "error": "Request timed out after 120s",
            "latency_ms": 120000,
            "response": "",
            "intent": "",
            "tool_calls": [],
        }
    except Exception as exc:
        return {
            "tc": tc["tc"],
            "status": "ERROR",
            "error": str(exc),
            "latency_ms": int((time.perf_counter() - start) * 1000),
            "response": "",
            "intent": "",
            "tool_calls": [],
        }


def _tool_outputs_concat(tool_calls: list[dict[str, Any]]) -> str:
    return "\n".join(str(tc.get("tool_output", "")) for tc in tool_calls)


async def _run_judges(
    test_cases: list[dict[str, Any]],
    results: list[dict[str, Any]],
    golden_index: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    judge_results: dict[str, dict[str, Any]] = {}
    for tc, result in zip(test_cases, results, strict=True):
        if result.get("status") != "OK":
            continue
        tc_id = tc["tc"]
        golden = golden_index.get(tc_id, {})
        reference = golden.get("response", "")
        tool_out = _tool_outputs_concat(result.get("tool_calls", []))
        sem = await judge_semantic(tc["input"], result["response"], reference, tool_out)
        ground = await judge_grounding(result["response"], tool_out)
        judge_results[tc_id] = {"semantic": sem, "grounding": ground}
    return judge_results


def score_all(
    test_cases: list[dict[str, Any]],
    results: list[dict[str, Any]],
    judge_results: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    scored: list[dict[str, Any]] = []
    for tc, result in zip(test_cases, results, strict=True):
        tc_id = tc["tc"]
        judges = (judge_results or {}).get(tc_id, {})
        sem_judge = judges.get("semantic", {}).get("normalized_score")
        ground_judge = judges.get("grounding", {}).get("faithfulness")

        task = score_task_completion(tc, result)
        tool = score_tool_accuracy(tc, result)
        semantic = score_semantic(tc, result, judge_score=sem_judge)
        grounding = score_grounding(tc, result, judge_score=ground_judge)
        latency = score_latency(result)
        cost = score_cost(result, MODEL)

        scored.append({
            "tc": tc_id,
            "task_completion": task,
            "tool_accuracy": tool,
            "semantic": semantic,
            "grounding": grounding,
            "latency": latency,
            "cost": cost,
            "judge": judges or None,
        })
    return scored


def aggregate_metrics(scored: list[dict[str, Any]]) -> dict[str, Any]:
    task_scores = [s["task_completion"]["score"] for s in scored]
    tool_scores = [s["tool_accuracy"]["score"] for s in scored if s["tool_accuracy"].get("score") is not None]
    sem_scores = [s["semantic"]["score"] for s in scored]
    ground_scores = [s["grounding"]["score"] for s in scored]
    latency_scores = [s["latency"] for s in scored]
    cost_scores = [s["cost"] for s in scored]

    return {
        "task_completion_rate": round(sum(task_scores) / len(task_scores) * 100, 1) if task_scores else 0,
        "tool_accuracy_avg": round(sum(tool_scores) / len(tool_scores), 4) if tool_scores else None,
        "semantic_avg": round(sum(sem_scores) / len(sem_scores), 4) if sem_scores else 0,
        "grounding_avg": round(sum(ground_scores) / len(ground_scores), 4) if ground_scores else 0,
        "latency": aggregate_latency(latency_scores),
        "cost": compute_cost_metrics(cost_scores),
    }


def _legacy_quality_verdicts(scored: list[dict[str, Any]]) -> list[str]:
    return [s["task_completion"]["verdict"] for s in scored]


def generate_agent_eval_markdown(
    test_cases: list[dict[str, Any]],
    results: list[dict[str, Any]],
    scored: list[dict[str, Any]],
    aggregates: dict[str, Any],
) -> str:
    now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    total = len(test_cases)
    lat = aggregates["latency"]

    lines = [
        "# Agent Evaluation Metrics Report",
        "",
        f"**Date:** {now}",
        f"**Test set:** {total} cases | **Model:** `{MODEL}`",
        "**Framework:** 6-metric (task, tool, semantic, grounding, latency, cost)",
        "",
        "---",
        "",
        "## 1. Aggregate Metrics",
        "",
        "| Metric | Value | Threshold |",
        "|:-------|------:|----------:|",
        f"| Task completion | **{aggregates['task_completion_rate']:.1f}%** | ≥85% |",
    ]
    tool_avg = aggregates.get("tool_accuracy_avg")
    tool_str = f"**{tool_avg:.2f}**" if tool_avg is not None else "N/A"
    lines.append(f"| Tool accuracy | {tool_str} | ≥0.80 |")
    lines.extend([
        f"| Semantic accuracy | **{aggregates['semantic_avg']:.2f}** | ≥0.75 |",
        f"| Grounding | **{aggregates['grounding_avg']:.2f}** | ≥0.70 |",
        f"| Latency p95 | **{lat['e2e_p95_ms']:,} ms** | ≤15,000 ms |",
        f"| Cost avg/task | **${aggregates['cost']['avg_cost_usd']:.4f}** | — |",
        "",
        "---",
        "",
        "## 2. Per-Test-Case Breakdown",
        "",
        "| TC | Task | Tool | Semantic | Ground | Latency | Cost |",
        "|:---|:---:|:---:|:---:|:---:|:---:|:---:|",
    ])

    for tc, result, s in zip(test_cases, results, scored, strict=True):
        task_icon = {"Pass": "✅", "Partial": "⚠️", "Fail": "❌"}.get(
            s["task_completion"]["verdict"], "—"
        )
        tool_s = s["tool_accuracy"]
        tool_cell = f"{tool_s['score']:.2f}" if tool_s.get("score") is not None else "—"
        lines.append(
            f"| {tc['tc']} | {task_icon} {s['task_completion']['score']:.1f} "
            f"| {tool_cell} | {s['semantic']['score']:.2f} "
            f"| {s['grounding']['score']:.2f} "
            f"| {result.get('latency_ms', 0):,}ms "
            f"| ${s['cost']['cost_usd']:.4f} |"
        )

    lines.extend([
        "",
        "---",
        "",
        "## 3. Methodology",
        "",
        "- **Task completion:** Multi-criteria rubric by category (HTTP OK + intent + outcome).",
        "- **Tool accuracy:** 0.35×selection + 0.25×args + 0.25×sequence + 0.15×success_rate vs `expected_tools`.",
        "- **Semantic:** Numeric extract ±tolerance; optional LLM judge (`--with-judge`).",
        "- **Grounding:** Rule-based number traceability to tool outputs; optional faithfulness judge.",
        "- **Latency:** Measured E2E + breakdown (router/core/tools/LLM) from API response.",
        "- **Cost:** Measured token usage when available; static estimate fallback.",
        "",
        "See also: [gate3_eval_metrics.md](./gate3_eval_metrics.md) for Gate G3 baseline.",
    ])
    return "\n".join(lines)


def generate_gate3_markdown(
    test_cases: list[dict[str, Any]],
    results: list[dict[str, Any]],
    scored: list[dict[str, Any]],
    aggregates: dict[str, Any],
) -> str:
    """Backward-compatible Gate G3 report."""
    now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    quality_verdicts = _legacy_quality_verdicts(scored)
    pass_count = quality_verdicts.count("Pass")
    partial_count = quality_verdicts.count("Partial")
    fail_count = quality_verdicts.count("Fail")
    total_tc = len(quality_verdicts)
    quality_score = aggregates["task_completion_rate"]
    p95 = aggregates["latency"]["e2e_p95_ms"]
    intent_matches = [
        tc.get("expected_intent") == r.get("intent")
        for tc, r in zip(test_cases, results, strict=True)
    ]
    intent_accuracy = sum(intent_matches) / len(intent_matches) * 100 if intent_matches else 0

    tool_succ = 0
    tool_total = 0
    for r in results:
        for tc_info in r.get("tool_calls", []):
            tool_total += 1
            if not str(tc_info.get("tool_output", "")).startswith("ERROR:"):
                tool_succ += 1
    tool_rate = (tool_succ / tool_total * 100) if tool_total > 0 else 0.0

    cost_avg = aggregates["cost"]["avg_cost_usd"]

    lines = [
        "# Gate G3 — Evaluation Metrics Report",
        "",
        f"**Ngày đánh giá:** {now}",
        f"**Test set:** {total_tc} test cases",
        f"**Model:** `{MODEL}`",
        "",
        "## Baseline Metrics (backward compatible)",
        "",
        "| Metric | Value |",
        "|:-------|------:|",
        f"| Latency p95 | {p95:,} ms |",
        f"| Tool Success Rate | {tool_rate:.1f}% |",
        f"| Answer Quality | {quality_score:.1f}% ({pass_count}P/{partial_count}Pt/{fail_count}F) |",
        f"| Cost per Query | ${cost_avg:.4f} |",
        f"| Intent Accuracy | {intent_accuracy:.1f}% |",
        "",
        "> Extended 6-metric report: [agent_eval_metrics.md](./agent_eval_metrics.md)",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Agent Evaluation — 6 metrics")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--test-cases", default=None)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--email", default="lecturer@epu.edu.vn")
    parser.add_argument("--password", default="123456")
    parser.add_argument("--with-judge", action="store_true", help="Run LLM-as-judge (costs tokens)")
    parser.add_argument("--results-file", default=None, help="Score existing results JSON (skip API calls)")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    tc_path = Path(args.test_cases) if args.test_cases else None
    test_cases = load_test_cases(tc_path)
    golden_index = golden_by_tc(load_golden_answers())

    if args.results_file:
        raw = json.loads(Path(args.results_file).read_text(encoding="utf-8"))
        results = raw.get("results", raw)
        logger.info("Loaded %d results from %s", len(results), args.results_file)
    else:
        try:
            token = login(args.base_url, args.email, args.password)
        except Exception as exc:
            logger.error("Login failed: %s", exc)
            sys.exit(1)

        results = []
        for i, tc in enumerate(test_cases, 1):
            logger.info("[%d/%d] Running %s", i, len(test_cases), tc["tc"])
            result = run_test_case(args.base_url, token, tc)
            results.append(result)
            logger.info(
                "  -> %s | %d ms | intent=%s | tools=%d",
                result["status"],
                result["latency_ms"],
                result.get("intent", "?"),
                len(result.get("tool_calls", [])),
            )
            time.sleep(1)

    judge_results: dict[str, dict[str, Any]] | None = None
    if args.with_judge:
        logger.info("Running LLM-as-judge (semantic + grounding)...")
        judge_results = asyncio.run(_run_judges(test_cases, results, golden_index))

    scored = score_all(test_cases, results, judge_results)
    aggregates = aggregate_metrics(scored)

    timestamp = datetime.now(UTC).isoformat()
    agent_output = {
        "timestamp": timestamp,
        "model": MODEL,
        "test_case_count": len(test_cases),
        "with_judge": args.with_judge,
        "results": results,
        "scores": scored,
        "aggregates": aggregates,
    }

    agent_json_path = output_dir / "agent_eval_results.json"
    agent_json_path.write_text(json.dumps(agent_output, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Saved %s", agent_json_path)

    agent_md = generate_agent_eval_markdown(test_cases, results, scored, aggregates)
    agent_md_path = output_dir / "agent_eval_metrics.md"
    agent_md_path.write_text(agent_md, encoding="utf-8")
    logger.info("Saved %s", agent_md_path)

    # Backward-compatible Gate G3 outputs
    gate3_output = {
        "timestamp": timestamp,
        "model": MODEL,
        "test_case_count": len(test_cases),
        "results": results,
        "quality_verdicts": _legacy_quality_verdicts(scored),
        "metrics": {
            "latency_p95_ms": aggregates["latency"]["e2e_p95_ms"],
            "latency_avg_ms": aggregates["latency"]["e2e_avg_ms"],
            "tool_success_rate": aggregates.get("tool_accuracy_avg"),
            "quality_score": aggregates["task_completion_rate"],
            "cost_per_query_usd": aggregates["cost"]["avg_cost_usd"],
            "semantic_avg": aggregates["semantic_avg"],
            "grounding_avg": aggregates["grounding_avg"],
        },
        "aggregates": aggregates,
    }
    gate3_json_path = output_dir / "gate3_eval_results.json"
    gate3_json_path.write_text(json.dumps(gate3_output, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Saved %s (backward compat)", gate3_json_path)

    gate3_md = generate_gate3_markdown(test_cases, results, scored, aggregates)
    gate3_md_path = output_dir / "gate3_eval_metrics.md"
    gate3_md_path.write_text(gate3_md, encoding="utf-8")
    logger.info("Saved %s (backward compat)", gate3_md_path)

    print("\n" + "=" * 60)
    print("  AGENT EVALUATION SUMMARY (6 metrics)")
    print("=" * 60)
    print(f"  Task completion:  {aggregates['task_completion_rate']:.1f}%")
    tool_avg = aggregates.get("tool_accuracy_avg")
    print(f"  Tool accuracy:    {tool_avg:.2f}" if tool_avg else "  Tool accuracy:    N/A")
    print(f"  Semantic:         {aggregates['semantic_avg']:.2f}")
    print(f"  Grounding:        {aggregates['grounding_avg']:.2f}")
    print(f"  Latency p95:      {aggregates['latency']['e2e_p95_ms']:,} ms")
    print(f"  Cost avg/task:    ${aggregates['cost']['avg_cost_usd']:.4f}")
    print("=" * 60)


if __name__ == "__main__":
    main()
