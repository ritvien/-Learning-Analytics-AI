"""Integration agent evaluation — requires live backend + LLM (@pytest.mark.eval)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.eval.dataset_loader import load_test_cases
from app.eval.scorers import score_task_completion, score_tool_accuracy

_EVAL_DIR = Path(__file__).resolve().parent.parent.parent / "docs" / "12-Evaluation"


@pytest.mark.eval
@pytest.mark.asyncio
async def test_agent_eval_sample_tc02_live(client):
    """Run TC02 against live chat API and verify basic scoring structure."""
    test_cases = load_test_cases()
    tc02 = next(tc for tc in test_cases if tc["tc"] == "TC02")

    resp = await client.post(
        "/api/v1/chat",
        json={"message": tc02["input"], "context": {}},
    )
    if resp.status_code == 503:
        pytest.skip("LLM credentials not configured")

    assert resp.status_code == 200
    data = resp.json()

    result = {
        "status": "OK",
        "response": data.get("response", ""),
        "intent": data.get("intent", ""),
        "tool_calls": data.get("tool_calls", []),
        "latency_ms": data.get("latency_ms", 0),
        "usage": data.get("usage"),
        "latency_breakdown": data.get("latency_breakdown"),
    }

    task = score_task_completion(tc02, result)
    tool = score_tool_accuracy(tc02, result)

    assert task["score"] >= 0.0
    assert "verdict" in task
    if result["tool_calls"]:
        assert tool.get("score") is not None

    if data.get("usage"):
        assert "total_tokens" in data["usage"]
    if data.get("latency_breakdown"):
        assert "total_ms" in data["latency_breakdown"]


@pytest.mark.eval
def test_agent_eval_results_file_structure():
    """Verify agent_eval_results.json schema if a prior run exists."""
    results_path = _EVAL_DIR / "agent_eval_results.json"
    if not results_path.exists():
        pytest.skip("No agent_eval_results.json — run scripts/run_evaluation.py first")

    raw = json.loads(results_path.read_text(encoding="utf-8"))
    assert "aggregates" in raw
    aggregates = raw["aggregates"]
    for key in ("task_completion_rate", "semantic_avg", "grounding_avg", "latency", "cost"):
        assert key in aggregates
