"""Cost scorer — measured tokens preferred, static estimate as fallback."""

from __future__ import annotations

from typing import Any

# Mirrors run_evaluation.py pricing
PRICING: dict[str, dict[str, float]] = {
    "gpt-5.4-nano": {
        "input_per_million": 0.20,
        "output_per_million": 1.25,
    },
}

TOKEN_ESTIMATES: dict[str, float] = {
    "router_system_prompt": 180,
    "router_response": 5,
    "core_system_prompt": 1800,
    "fast_system_prompt": 120,
    "avg_user_query": 35,
    "avg_tool_input_per_call": 120,
    "avg_tool_output_per_call": 300,
    "avg_core_response": 250,
    "avg_fast_response": 60,
    "avg_tool_calls_per_core": 1.5,
}


def _estimate_cost(result: dict[str, Any], model: str = "gpt-5.4-nano") -> float:
    """Fallback static cost estimate when usage metadata unavailable."""
    pricing = PRICING.get(model, PRICING["gpt-5.4-nano"])
    te = TOKEN_ESTIMATES
    input_price = pricing["input_per_million"] / 1_000_000
    output_price = pricing["output_per_million"] / 1_000_000

    intent = result.get("intent", "unknown")
    tool_count = len(result.get("tool_calls", []))

    router_cost = (te["router_system_prompt"] + te["avg_user_query"]) * input_price
    router_cost += te["router_response"] * output_price

    if intent == "core_agent":
        core_input = te["core_system_prompt"] + te["avg_user_query"]
        avg_tools = tool_count or te["avg_tool_calls_per_core"]
        core_cost = core_input * input_price
        core_cost += avg_tools * te["avg_tool_input_per_call"] * input_price
        core_cost += avg_tools * te["avg_tool_output_per_call"] * input_price
        core_cost += te["avg_core_response"] * output_price
        return router_cost + core_cost

    fast_input = te["fast_system_prompt"] + te["avg_user_query"]
    fast_cost = fast_input * input_price + te["avg_fast_response"] * output_price
    return router_cost + fast_cost


def score_cost(result: dict[str, Any], model: str = "gpt-5.4-nano") -> dict[str, Any]:
    """Per-task cost from measured usage or estimate."""
    usage = result.get("usage") or {}
    measured = float(usage.get("cost_usd", 0) or 0)
    source = "measured" if measured > 0 else "estimated"
    cost_usd = measured if measured > 0 else _estimate_cost(result, model)

    return {
        "cost_usd": round(cost_usd, 6),
        "source": source,
        "prompt_tokens": int(usage.get("prompt_tokens", 0) or 0),
        "completion_tokens": int(usage.get("completion_tokens", 0) or 0),
        "total_tokens": int(usage.get("total_tokens", 0) or 0),
    }


def compute_cost_metrics(cost_scores: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate cost across all tasks."""
    costs = [s["cost_usd"] for s in cost_scores]
    measured_count = sum(1 for s in cost_scores if s.get("source") == "measured")
    if not costs:
        return {"avg_cost_usd": 0.0, "p50_cost_usd": 0.0, "p95_cost_usd": 0.0, "measured_rate": 0.0}

    sorted_costs = sorted(costs)
    p50_idx = int(0.50 * len(sorted_costs))
    p95_idx = int(0.95 * len(sorted_costs))

    return {
        "avg_cost_usd": round(sum(costs) / len(costs), 6),
        "p50_cost_usd": round(sorted_costs[min(p50_idx, len(sorted_costs) - 1)], 6),
        "p95_cost_usd": round(sorted_costs[min(p95_idx, len(sorted_costs) - 1)], 6),
        "measured_rate": round(measured_count / len(cost_scores), 4),
    }
