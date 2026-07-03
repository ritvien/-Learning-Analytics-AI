"""Rule-based grounding scorer - factual claims must trace to tool outputs."""

from __future__ import annotations

import re
from typing import Any

from app.eval.numeric_match import values_match
from app.eval.scorers.semantic import extract_numbers

_RISK_PERCENT_PATTERN = re.compile(
    r"(?:nguy cơ|rủi ro|risk|dropout|bỏ học).{0,40}\d+(?:[.,]\d+)?\s*%|"
    r"\d+(?:[.,]\d+)?\s*%.{0,40}(?:nguy cơ|rủi ro|risk|dropout|bỏ học)",
    re.IGNORECASE,
)
_IDENTIFIER_NUMBER_PATTERNS = (
    re.compile(r"\b\d{11}\b"),
    re.compile(r"\b20[12]\d\b"),
    re.compile(r"\b(?:K|khóa\s*)\d{2}\b", re.IGNORECASE),
    re.compile(r"\b\d{7}\b"),
)


def _numbers_from_tool_outputs(tool_calls: list[dict[str, Any]]) -> list[float]:
    numbers: list[float] = []
    for tc_info in tool_calls:
        output = str(tc_info.get("tool_output", ""))
        if output.startswith("ERROR:"):
            continue
        numbers.extend(extract_numbers(output))
    return numbers


def _claims_ml_dropout_probability(response: str) -> bool:
    """True when response states a numeric ML dropout/risk probability."""
    return bool(_RISK_PERCENT_PATTERN.search(response))


def _identifier_numbers(text: str) -> set[float]:
    excluded: set[float] = set()
    for pattern in _IDENTIFIER_NUMBER_PATTERNS:
        for match in pattern.finditer(text):
            digits = "".join(ch for ch in match.group(0) if ch.isdigit())
            if digits:
                excluded.add(float(digits))
    return excluded


def score_grounding(
    tc: dict[str, Any],
    result: dict[str, Any],
    *,
    judge_score: float | None = None,
) -> dict[str, Any]:
    """Rule-based grounding: response numbers must appear in tool outputs."""
    response = result.get("response", "")
    tool_calls = result.get("tool_calls", [])
    category = tc.get("category", "")

    if category.startswith("guardrail") or category == "chit_chat":
        rule_score = 1.0
        return {
            "score": round(judge_score if judge_score is not None else rule_score, 4),
            "rule_score": rule_score,
            "judge_score": judge_score,
            "unsupported": [],
            "skipped_rules": True,
        }

    response_numbers = extract_numbers(response)
    tool_numbers = _numbers_from_tool_outputs(tool_calls)
    identifier_numbers = _identifier_numbers(response)

    significant_response = [
        n
        for n in response_numbers
        if not (n == int(n) and 0 < n <= 10) and n not in identifier_numbers
    ]

    unsupported: list[float] = []
    if significant_response and not tool_numbers:
        unsupported = significant_response
        rule_score = 0.0
    elif not significant_response:
        rule_score = 1.0
    else:
        matched = 0
        for num in significant_response:
            if any(values_match(num, tn, 0.02) for tn in tool_numbers):
                matched += 1
            else:
                unsupported.append(num)
        rule_score = matched / len(significant_response) if significant_response else 1.0

    if _claims_ml_dropout_probability(response):
        tool_names = [tc_info.get("tool_name", "") for tc_info in tool_calls]
        if "get_student_dropout_risk" not in tool_names:
            rule_score = min(rule_score, 0.0)

    if judge_score is not None:
        final = min(rule_score, judge_score)
    else:
        final = rule_score

    return {
        "score": round(final, 4),
        "rule_score": round(rule_score, 4),
        "judge_score": judge_score,
        "unsupported": unsupported[:10],
        "skipped_rules": False,
    }
