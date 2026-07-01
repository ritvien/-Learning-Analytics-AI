"""Query LangSmith API for runtime metrics — tokens, cost, latency, TTFT, tool runs.

This module is the *single source of truth* for runtime observability data
used by the evaluation framework.  It polls the LangSmith API (which ingests
traces asynchronously) and extracts structured metrics from the root trace
and its child runs.

Usage::

    metrics = fetch_langsmith_metrics(tc_trace_id="<uuid>", project="EduInsight")
"""

from __future__ import annotations

import logging
import os
import time
from datetime import UTC, datetime
from typing import Any

from langsmith import Client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

_MISSING_SENTINEL: dict[str, Any] = {
    "status": "missing_langsmith",
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0,
    "prompt_token_details": None,
    "completion_token_details": None,
    "total_cost": 0.0,
    "prompt_cost": 0.0,
    "completion_cost": 0.0,
    "latency_ms": 0,
    "first_token_time": None,
    "ttft_ms": None,
    "error": None,
    "trace_url": None,
    "child_runs": [],
}


def _make_client() -> Client:
    """Create a LangSmith client using env vars."""
    return Client(
        api_key=os.getenv("LANGSMITH_API_KEY", ""),
        api_url=os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com"),
    )


def _ts_to_ms(dt: datetime | None) -> int | None:
    """Convert a datetime to epoch-ms, handling tz-aware/naive."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return int(dt.timestamp() * 1000)


def _compute_ttft(start_time: datetime | None, first_token_time: datetime | None) -> int | None:
    """Compute TTFT in ms from start_time and first_token_time."""
    if start_time is None or first_token_time is None:
        return None
    # Normalise both to UTC-aware
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=UTC)
    if first_token_time.tzinfo is None:
        first_token_time = first_token_time.replace(tzinfo=UTC)
    delta_ms = int((first_token_time - start_time).total_seconds() * 1000)
    return max(0, delta_ms)


# ---------------------------------------------------------------------------
# Root run parsing
# ---------------------------------------------------------------------------

def parse_root_run(run: Any) -> dict[str, Any]:
    """Extract structured metrics from a LangSmith root Run object.

    Returns a dict with keys matching ``_MISSING_SENTINEL`` but populated
    with real values when available.
    """
    # -- Token usage --------------------------------------------------------
    # LangSmith stores aggregated token usage on the root run under
    # ``run.total_tokens``, ``run.prompt_tokens``, ``run.completion_tokens``
    # *or* inside ``run.extra["metrics"]``.
    prompt_tokens = 0
    completion_tokens = 0
    total_tokens = 0
    prompt_token_details: dict[str, Any] | None = None
    completion_token_details: dict[str, Any] | None = None

    # Primary: top-level attributes
    prompt_tokens = int(getattr(run, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(run, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(run, "total_tokens", 0) or 0)
    if not total_tokens:
        total_tokens = prompt_tokens + completion_tokens

    # Fallback: extra.metrics
    extra = getattr(run, "extra", None) or {}
    metrics = extra.get("metrics", {}) if isinstance(extra, dict) else {}
    if not prompt_tokens and metrics:
        prompt_tokens = int(metrics.get("prompt_tokens", 0) or 0)
        completion_tokens = int(metrics.get("completion_tokens", 0) or 0)
        total_tokens = int(metrics.get("total_tokens", 0) or prompt_tokens + completion_tokens)

    # Token detail breakdown (cached tokens etc.)
    if isinstance(extra, dict):
        prompt_token_details = extra.get("prompt_token_details")
        completion_token_details = extra.get("completion_token_details")

    # -- Cost ---------------------------------------------------------------
    total_cost = 0.0
    prompt_cost = 0.0
    completion_cost = 0.0

    # LangSmith may store cost in extra.metrics or as top-level attrs
    if metrics:
        total_cost = float(metrics.get("total_cost", 0) or 0)
        prompt_cost = float(metrics.get("prompt_cost", 0) or 0)
        completion_cost = float(metrics.get("completion_cost", 0) or 0)

    # Top-level attrs (some SDK versions)
    if not total_cost:
        total_cost = float(getattr(run, "total_cost", 0) or 0)
        prompt_cost = float(getattr(run, "prompt_cost", 0) or 0)
        completion_cost = float(getattr(run, "completion_cost", 0) or 0)

    # Feedback-based cost (LangSmith auto-cost feedback)
    if not total_cost:
        feedback_results = getattr(run, "feedback_stats", None) or {}
        if isinstance(feedback_results, dict):
            cost_fb = feedback_results.get("total_cost")
            if cost_fb is not None:
                total_cost = float(cost_fb.get("avg", 0) if isinstance(cost_fb, dict) else cost_fb)

    # -- Latency / TTFT -----------------------------------------------------
    start_time = getattr(run, "start_time", None)
    end_time = getattr(run, "end_time", None)
    first_token_time_raw = getattr(run, "first_token_time", None)

    latency_ms = 0
    if start_time and end_time:
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=UTC)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=UTC)
        latency_ms = int((end_time - start_time).total_seconds() * 1000)

    ttft_ms = _compute_ttft(start_time, first_token_time_raw)

    # -- Status / Error -----------------------------------------------------
    status = getattr(run, "status", "unknown") or "unknown"
    error = getattr(run, "error", None)

    # -- Trace URL ----------------------------------------------------------
    run_id = getattr(run, "id", None)
    project_name = getattr(run, "session_name", None) or getattr(run, "project_name", None)
    trace_url = None
    if run_id:
        trace_url = f"https://smith.langchain.com/o/default/projects/p/{project_name}/r/{run_id}" if project_name else f"https://smith.langchain.com/runs/{run_id}"
    # Try run.url if available
    if hasattr(run, "url") and run.url:
        trace_url = str(run.url)

    return {
        "status": status,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "prompt_token_details": prompt_token_details,
        "completion_token_details": completion_token_details,
        "total_cost": round(total_cost, 8),
        "prompt_cost": round(prompt_cost, 8),
        "completion_cost": round(completion_cost, 8),
        "latency_ms": latency_ms,
        "first_token_time": first_token_time_raw.isoformat() if first_token_time_raw else None,
        "ttft_ms": ttft_ms,
        "error": error,
        "trace_url": trace_url,
    }


# ---------------------------------------------------------------------------
# Child runs parsing
# ---------------------------------------------------------------------------

def parse_child_runs(child_runs: list[Any]) -> list[dict[str, Any]]:
    """Flatten child runs into structured tool/LLM call records.

    Returns a list sorted by ``start_time`` (then ``dotted_order``).
    """
    records: list[dict[str, Any]] = []
    for run in child_runs:
        run_type = getattr(run, "run_type", "unknown")
        name = getattr(run, "name", "unknown")
        start = getattr(run, "start_time", None)
        end = getattr(run, "end_time", None)
        dotted_order = getattr(run, "dotted_order", "") or ""

        duration_ms = 0
        if start and end:
            if start.tzinfo is None:
                start = start.replace(tzinfo=UTC)
            if end.tzinfo is None:
                end = end.replace(tzinfo=UTC)
            duration_ms = int((end - start).total_seconds() * 1000)

        error = getattr(run, "error", None)
        status = getattr(run, "status", "unknown") or "unknown"

        record: dict[str, Any] = {
            "run_type": run_type,
            "name": name,
            "duration_ms": duration_ms,
            "status": status,
            "error": error,
            "dotted_order": dotted_order,
            "start_time": start.isoformat() if start else None,
        }

        if run_type == "tool":
            inputs = getattr(run, "inputs", None) or {}
            outputs = getattr(run, "outputs", None) or {}
            record["tool_input"] = _to_json_safe(inputs)
            record["tool_output"] = _to_json_safe(outputs)
            record["tool_input_summary"] = _summarize(inputs, max_len=200)
            record["tool_output_summary"] = _summarize(outputs, max_len=300)

        if run_type == "llm":
            record["prompt_tokens"] = int(getattr(run, "prompt_tokens", 0) or 0)
            record["completion_tokens"] = int(getattr(run, "completion_tokens", 0) or 0)
            record["total_tokens"] = int(getattr(run, "total_tokens", 0) or 0)
            extra = getattr(run, "extra", None) or {}
            if isinstance(extra, dict):
                invoc = extra.get("invocation_params", {})
                record["model"] = invoc.get("model", "") if isinstance(invoc, dict) else ""

        records.append(record)

    # Sort: start_time primary, dotted_order secondary
    def _sort_key(r: dict[str, Any]) -> tuple:
        st = r.get("start_time") or ""
        do = r.get("dotted_order") or ""
        return (st, do)

    records.sort(key=_sort_key)
    return records


def _summarize(obj: Any, max_len: int = 200) -> str:
    """Create a truncated string summary of inputs/outputs."""
    import json as _json

    try:
        text = _json.dumps(obj, ensure_ascii=False, default=str)
    except Exception:
        text = str(obj)
    if len(text) > max_len:
        return text[:max_len] + "...[truncated]"
    return text


def _to_json_safe(obj: Any) -> Any:
    """Return a JSON-serializable copy while preserving structured dict/list shape."""
    import json as _json

    try:
        return _json.loads(_json.dumps(obj, ensure_ascii=False, default=str))
    except Exception:
        return str(obj)


# ---------------------------------------------------------------------------
# High-level fetch
# ---------------------------------------------------------------------------

def fetch_langsmith_metrics(
    tc_trace_id: str,
    *,
    project: str | None = None,
    timeout_s: int = 30,
    poll_interval_s: float = 2.0,
) -> dict[str, Any]:
    """Poll LangSmith for a root trace matching ``metadata.trace_id == tc_trace_id``.

    Returns a dict with all runtime metrics, or ``_MISSING_SENTINEL`` if the
    trace is not found within *timeout_s* seconds.
    """
    project = project or os.getenv("LANGSMITH_PROJECT", "EduInsight")
    client = _make_client()

    deadline = time.monotonic() + timeout_s
    root_run = None

    while time.monotonic() < deadline:
        try:
            runs = list(
                client.list_runs(
                    project_name=project,
                    filter=f'and(eq(metadata_key, "trace_id"), eq(metadata_value, "{tc_trace_id}"))',
                    is_root=True,
                    limit=1,
                )
            )
            if runs:
                root_run = runs[0]
                # Wait until the run has finished
                status = getattr(root_run, "status", "")
                if status in ("success", "error"):
                    break
                # Still running — keep polling
                root_run = None
        except Exception as exc:
            logger.warning("LangSmith poll error (will retry): %s", exc)

        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(poll_interval_s, remaining))

    if root_run is None:
        logger.warning("LangSmith trace not found for trace_id=%s after %ds", tc_trace_id, timeout_s)
        return dict(_MISSING_SENTINEL)

    # Parse root run
    result = parse_root_run(root_run)

    # Fetch and parse child runs
    try:
        child_runs_raw = list(
            client.list_runs(
                project_name=project,
                trace_id=str(getattr(root_run, "trace_id", getattr(root_run, "id", ""))),
                is_root=False,
            )
        )
        result["child_runs"] = parse_child_runs(child_runs_raw)
    except Exception as exc:
        logger.warning("Failed to fetch child runs: %s", exc)
        result["child_runs"] = []

    return result
