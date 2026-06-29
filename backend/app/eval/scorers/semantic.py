"""Rule-based semantic accuracy — numeric extraction and entity matching."""

from __future__ import annotations

import re
from typing import Any

from app.eval.numeric_match import values_match

_NUMBER_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])"
    r"(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)"
    r"(?![A-Za-z0-9])"
)
_ENTITY_PATTERN = re.compile(r"\b(CRS\d{4}|\d{11})\b")


def extract_numbers(text: str) -> list[float]:
    """Extract numeric values from text, handling Vietnamese locale separators."""
    numbers: list[float] = []
    for match in _NUMBER_PATTERN.finditer(text):
        raw = match.group(1)
        normalized = raw.replace(",", "")
        if raw.count(",") > 0 and raw.count(".") == 0:
            # European-style decimal comma only when single comma
            parts = raw.split(",")
            if len(parts) == 2 and len(parts[1]) <= 2:
                normalized = parts[0].replace(".", "") + "." + parts[1]
            else:
                normalized = raw.replace(",", "")
        elif raw.count(".") > 1:
            normalized = raw.replace(".", "")
        try:
            numbers.append(float(normalized))
        except ValueError:
            continue
    return numbers


def extract_entities(text: str) -> set[str]:
    return set(_ENTITY_PATTERN.findall(text))


def score_semantic(
    tc: dict[str, Any],
    result: dict[str, Any],
    *,
    judge_score: float | None = None,
) -> dict[str, Any]:
    """Score semantic accuracy via numeric match; optionally blend with LLM judge."""
    response = result.get("response", "")
    expected_values = tc.get("expected_values", [])
    category = tc.get("category", "")

    if category.startswith("guardrail"):
        # Guardrail TCs: keyword/refusal quality proxy
        keywords = tc.get("expected_keywords", [])
        if keywords:
            response_lower = response.lower()
            matched = sum(1 for kw in keywords if kw.lower() in response_lower)
            numeric_score = matched / len(keywords) if keywords else 1.0
        else:
            numeric_score = 1.0
        if judge_score is not None:
            final = 0.5 * numeric_score + 0.5 * judge_score
        else:
            final = numeric_score
        return {
            "score": round(final, 4),
            "numeric_score": round(numeric_score, 4),
            "judge_score": judge_score,
            "matches": [],
        }

    if not expected_values:
        # Fallback: keyword overlap when no golden numerics
        keywords = tc.get("expected_keywords", [])
        if keywords:
            response_lower = response.lower()
            matched = sum(1 for kw in keywords if kw.lower() in response_lower)
            numeric_score = matched / len(keywords)
        else:
            numeric_score = 1.0 if response.strip() else 0.0
        if judge_score is not None:
            final = 0.5 * numeric_score + 0.5 * judge_score
        else:
            final = numeric_score
        return {
            "score": round(final, 4),
            "numeric_score": round(numeric_score, 4),
            "judge_score": judge_score,
            "matches": [],
        }

    found_numbers = extract_numbers(response)
    matches: list[dict[str, Any]] = []
    matched_count = 0

    for ev in expected_values:
        expected_val = float(ev["value"])
        tolerance = float(ev.get("tolerance", 0.02))
        field = ev.get("field", "")
        hit = any(values_match(expected_val, n, tolerance) for n in found_numbers)
        matches.append({"field": field, "expected": expected_val, "matched": hit})
        if hit:
            matched_count += 1

    numeric_score = matched_count / len(expected_values) if expected_values else 1.0

    if judge_score is not None:
        final = 0.5 * numeric_score + 0.5 * judge_score
    else:
        final = numeric_score

    return {
        "score": round(final, 4),
        "numeric_score": round(numeric_score, 4),
        "judge_score": judge_score,
        "matches": matches,
        "found_numbers": found_numbers[:20],
    }
