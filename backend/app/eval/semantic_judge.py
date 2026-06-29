"""LLM-as-judge for semantic accuracy (manual / --with-judge only)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.agent.nodes import get_model
from app.config import get_settings

logger = logging.getLogger(__name__)

JUDGE_SYSTEM_PROMPT = """You are an expert evaluator for an academic analytics chatbot (EduInsight).
Score the agent response against the reference answer using this rubric (1-5 each):
- correctness: factual accuracy vs reference
- completeness: covers all key points from reference

Respond ONLY with valid JSON:
{"correctness": <1-5>, "completeness": <1-5>, "reasoning": "<brief explanation>"}
"""


def _parse_judge_json(text: str) -> dict[str, Any]:
    match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if not match:
        return {"correctness": 3, "completeness": 3, "reasoning": "parse failed"}
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return {"correctness": 3, "completeness": 3, "reasoning": "json decode failed"}


def normalize_judge_score(correctness: int, completeness: int) -> float:
    """Map 1-5 rubric to 0.0-1.0."""
    avg = (max(1, min(5, correctness)) + max(1, min(5, completeness))) / 2
    return round((avg - 1) / 4, 4)


async def judge_semantic(
    question: str,
    agent_response: str,
    reference_answer: str,
    tool_outputs: str = "",
    *,
    model: str | None = None,
) -> dict[str, Any]:
    """Run LLM judge for semantic accuracy."""
    settings = get_settings()
    judge_model = model or settings.llm_model or "gpt-4o"

    context_block = ""
    if tool_outputs:
        truncated = tool_outputs[:4000]
        context_block = f"\n\nTool outputs (truncated):\n{truncated}"

    user_content = (
        f"Question: {question}\n\n"
        f"Reference answer:\n{reference_answer}\n\n"
        f"Agent response:\n{agent_response}"
        f"{context_block}"
    )

    llm = get_model(judge_model, temperature=0)
    try:
        response = await llm.ainvoke(
            [SystemMessage(content=JUDGE_SYSTEM_PROMPT), HumanMessage(content=user_content)]
        )
        parsed = _parse_judge_json(str(response.content))
        correctness = int(parsed.get("correctness", 3))
        completeness = int(parsed.get("completeness", 3))
        normalized = normalize_judge_score(correctness, completeness)
        return {
            "correctness": correctness,
            "completeness": completeness,
            "normalized_score": normalized,
            "reasoning": parsed.get("reasoning", ""),
            "model": judge_model,
        }
    except Exception as exc:
        logger.warning("semantic judge failed: %s", exc)
        return {
            "correctness": 0,
            "completeness": 0,
            "normalized_score": 0.0,
            "reasoning": str(exc),
            "model": judge_model,
            "error": True,
        }
