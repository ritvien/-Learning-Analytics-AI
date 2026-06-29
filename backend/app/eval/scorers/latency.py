"""Latency scorer and aggregate percentile metrics."""

from __future__ import annotations

import statistics
from typing import Any


def _percentile(values: list[int], pct: float) -> int:
    if not values:
        return 0
    sorted_vals = sorted(values)
    idx = int(pct * len(sorted_vals))
    return sorted_vals[min(idx, len(sorted_vals) - 1)]


def score_latency(result: dict[str, Any]) -> dict[str, Any]:
    """Per-task latency breakdown from API response."""
    total_ms = int(result.get("latency_ms", 0))
    breakdown = result.get("latency_breakdown") or {}
    tools = breakdown.get("tools") or []

    if not tools:
        tools = [
            {
                "tool_name": tc.get("tool_name", ""),
                "duration_ms": int(tc.get("duration_ms", 0) or 0),
                "sequence": tc.get("sequence", idx + 1),
            }
            for idx, tc in enumerate(result.get("tool_calls", []))
            if tc.get("duration_ms") is not None
        ]

    tool_durations = [int(t.get("duration_ms", 0)) for t in tools]
    tool_sum = sum(tool_durations)
    llm_ms = int(breakdown.get("llm_ms", 0))
    overhead = int(breakdown.get("overhead_ms", max(0, total_ms - tool_sum - llm_ms)))

    return {
        "total_ms": total_ms,
        "llm_ms": llm_ms,
        "tools_ms": int(breakdown.get("tools_ms", tool_sum)),
        "tool_max_ms": max(tool_durations) if tool_durations else 0,
        "overhead_ms": overhead,
        "tools": tools,
    }


def aggregate_latency(latency_scores: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute p50/p95/p99 across tasks."""
    totals = [s["total_ms"] for s in latency_scores if s.get("total_ms")]
    tool_maxes = [s["tool_max_ms"] for s in latency_scores if s.get("tool_max_ms")]
    llm_sums = [s["llm_ms"] for s in latency_scores if s.get("llm_ms")]

    return {
        "e2e_p50_ms": _percentile(totals, 0.50),
        "e2e_p95_ms": _percentile(totals, 0.95),
        "e2e_p99_ms": _percentile(totals, 0.99),
        "e2e_avg_ms": int(statistics.mean(totals)) if totals else 0,
        "tool_p95_ms": _percentile(tool_maxes, 0.95),
        "llm_p95_ms": _percentile(llm_sums, 0.95),
    }
