"""LLM faithfulness judge for grounding (manual / --with-judge only)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.nodes import get_model
from app.config import get_settings

logger = logging.getLogger(__name__)

GROUNDING_JUDGE_PROMPT = """You evaluate whether an agent response is faithful to its tool outputs.
List any factual claims in the response that are NOT supported by the tool outputs.
Then score faithfulness from 0.0 (all claims unsupported) to 1.0 (fully grounded).

Respond ONLY with valid JSON:
{"unsupported_claims": ["claim1", ...], "faithfulness": <0.0-1.0>, "reasoning": "<brief>"}
"""


def _parse_grounding_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {"unsupported_claims": [], "faithfulness": 0.5, "reasoning": "parse failed"}
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return {"unsupported_claims": [], "faithfulness": 0.5, "reasoning": "json decode failed"}


async def judge_grounding(
    agent_response: str,
    tool_outputs: str,
    *,
    model: str | None = None,
) -> dict[str, Any]:
    """Run LLM faithfulness judge against concatenated tool outputs."""
    settings = get_settings()
    judge_model = model or settings.llm_model or "gpt-4o"
    truncated_tools = tool_outputs[:4000]

    user_content = (
        f"Tool outputs:\n{truncated_tools or '(none)'}\n\n"
        f"Agent response:\n{agent_response}"
    )

    llm = get_model(judge_model, temperature=0)
    try:
        response = await llm.ainvoke(
            [SystemMessage(content=GROUNDING_JUDGE_PROMPT), HumanMessage(content=user_content)]
        )
        parsed = _parse_grounding_json(str(response.content))
        faithfulness = float(parsed.get("faithfulness", 0.5))
        faithfulness = max(0.0, min(1.0, faithfulness))
        return {
            "faithfulness": round(faithfulness, 4),
            "unsupported_claims": parsed.get("unsupported_claims", [])[:10],
            "reasoning": parsed.get("reasoning", ""),
            "model": judge_model,
        }
    except Exception as exc:
        logger.warning("grounding judge failed: %s", exc)
        return {
            "faithfulness": 0.0,
            "unsupported_claims": [],
            "reasoning": str(exc),
            "model": judge_model,
            "error": True,
        }
