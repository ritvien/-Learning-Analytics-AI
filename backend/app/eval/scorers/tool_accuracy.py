"""Tool-call accuracy scorer."""

from __future__ import annotations

import re
from typing import Any

_FORBIDDEN_SQL = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE)\b",
    re.IGNORECASE,
)


def _longest_common_subsequence(a: list[str], b: list[str]) -> int:
    if not a or not b:
        return 0
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[len(a)][len(b)]


def _validate_tool_args(tool_name: str, tool_input: dict[str, Any]) -> bool:
    if tool_name == "execute_sql_query":
        query = str(tool_input.get("query", ""))
        if not query.strip():
            return False
        return _FORBIDDEN_SQL.search(query) is None
    if tool_name == "lookup_student_by_code":
        return bool(str(tool_input.get("student_code", "")).strip())
    if tool_name == "get_student_dropout_risk":
        return bool(str(tool_input.get("student_code", "")).strip())
    if tool_name == "calculate_student_clo_scores":
        return bool(tool_input.get("student_code")) and bool(tool_input.get("course_name"))
    return bool(tool_input)


def score_tool_accuracy(tc: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    """Composite tool accuracy: selection + args + sequence + success rate."""
    expected = tc.get("expected_tools", [])
    if not expected:
        return {"score": None, "skipped": True, "reason": "no expected_tools"}

    actual_calls = result.get("tool_calls", [])
    actual_names = [tc_info.get("tool_name", "") for tc_info in actual_calls]

    expected_set = set(expected)
    actual_set = set(actual_names)
    if expected_set:
        selection_score = len(expected_set & actual_set) / len(expected_set)
    else:
        selection_score = 1.0 if not actual_names else 0.0

    arg_scores: list[float] = []
    for tc_info in actual_calls:
        name = tc_info.get("tool_name", "")
        tool_input = tc_info.get("tool_input", {})
        if name in expected_set or not expected_set:
            arg_scores.append(1.0 if _validate_tool_args(name, tool_input) else 0.0)
    arg_validity = sum(arg_scores) / len(arg_scores) if arg_scores else 0.0

    if len(expected) > 1:
        lcs = _longest_common_subsequence(actual_names, expected)
        sequence_score = lcs / len(expected)
    elif len(expected) == 1:
        sequence_score = 1.0 if expected[0] in actual_names else 0.0
    else:
        sequence_score = 1.0

    success_rate = (
        sum(1 for tc_info in actual_calls if not str(tc_info.get("tool_output", "")).startswith("ERROR:"))
        / len(actual_calls)
        if actual_calls
        else 1.0
    )

    composite = (
        0.35 * selection_score
        + 0.25 * arg_validity
        + 0.25 * sequence_score
        + 0.15 * success_rate
    )

    return {
        "score": round(composite, 4),
        "selection_score": round(selection_score, 4),
        "arg_validity": round(arg_validity, 4),
        "sequence_score": round(sequence_score, 4),
        "success_rate": round(success_rate, 4),
        "actual_tools": actual_names,
        "expected_tools": expected,
        "skipped": False,
    }
