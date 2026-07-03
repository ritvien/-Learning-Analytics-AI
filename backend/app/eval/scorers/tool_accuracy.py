"""Tool-call accuracy scorer."""

from __future__ import annotations

import re
from collections import Counter
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


def _expected_counts(tc: dict[str, Any], expected_sequence: list[str]) -> Counter[str]:
    configured = tc.get("expected_tool_counts") or {}
    if configured:
        return Counter({str(name): int(count) for name, count in configured.items()})
    return Counter(expected_sequence)


def score_tool_accuracy(tc: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    """Composite tool accuracy: selection + args + ordered sequence + counts + success."""
    expected = tc.get("expected_tools", [])
    expected_sequence = tc.get("expected_tool_sequence") or expected
    expected = expected or list(dict.fromkeys(expected_sequence))
    expected_counts = _expected_counts(tc, expected_sequence)
    has_explicit_sequence = bool(tc.get("expected_tool_sequence"))
    actual_calls = result.get("tool_calls", [])
    actual_names = [tc_info.get("tool_name", "") for tc_info in actual_calls]
    policy = tc.get("tool_policy", "required" if expected else "skip")

    if policy == "forbidden":
        if not actual_calls:
            return {
                "score": 1.0,
                "selection_score": 1.0,
                "arg_validity": 1.0,
                "sequence_score": 1.0,
                "count_score": 1.0,
                "success_rate": 1.0,
                "actual_tools": actual_names,
                "expected_tools": expected,
                "expected_tool_sequence": expected_sequence,
                "expected_tool_counts": dict(expected_counts),
                "tool_policy": policy,
                "skipped": False,
            }
        return {
            "score": 0.0,
            "selection_score": 0.0,
            "arg_validity": 0.0,
            "sequence_score": 0.0,
            "count_score": 0.0,
            "success_rate": 0.0,
            "actual_tools": actual_names,
            "expected_tools": expected,
            "expected_tool_sequence": expected_sequence,
            "expected_tool_counts": dict(expected_counts),
            "tool_policy": policy,
            "skipped": False,
            "reason": "tool calls are forbidden for this case",
        }

    if not expected:
        return {"score": None, "skipped": True, "reason": "no expected_tools", "tool_policy": policy}

    if policy == "optional" and not actual_calls:
        return {
            "score": None,
            "skipped": True,
            "reason": "optional tool not used",
            "actual_tools": actual_names,
            "expected_tools": expected,
            "expected_tool_sequence": expected_sequence,
            "expected_tool_counts": dict(expected_counts),
            "tool_policy": policy,
        }

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

    if len(expected_sequence) > 1:
        lcs = _longest_common_subsequence(actual_names, expected_sequence)
        sequence_score = lcs / len(expected_sequence)
    elif len(expected_sequence) == 1:
        sequence_score = 1.0 if expected_sequence[0] in actual_names else 0.0
    else:
        sequence_score = 1.0

    actual_counts = Counter(actual_names)
    if expected_counts:
        count_score = sum(
            min(actual_counts.get(tool_name, 0), required_count) / required_count
            for tool_name, required_count in expected_counts.items()
            if required_count > 0
        ) / len(expected_counts)
    else:
        count_score = 1.0

    allowed_error_prefixes = tuple(tc.get("allowed_tool_error_prefixes", []))
    success_count = 0
    for tc_info in actual_calls:
        output = str(tc_info.get("tool_output", ""))
        if not output.startswith("ERROR:") or (
            allowed_error_prefixes and output.startswith(allowed_error_prefixes)
        ):
            success_count += 1
    success_rate = success_count / len(actual_calls) if actual_calls else 1.0

    composite = (
        0.20 * selection_score
        + 0.15 * arg_validity
        + 0.35 * sequence_score
        + 0.20 * count_score
        + 0.10 * success_rate
    )
    if has_explicit_sequence and (sequence_score < 1.0 or count_score < 1.0):
        composite = min(composite, 0.75)

    return {
        "score": round(composite, 4),
        "selection_score": round(selection_score, 4),
        "arg_validity": round(arg_validity, 4),
        "sequence_score": round(sequence_score, 4),
        "count_score": round(count_score, 4),
        "success_rate": round(success_rate, 4),
        "actual_tools": actual_names,
        "expected_tools": expected,
        "expected_tool_sequence": expected_sequence,
        "expected_tool_counts": dict(expected_counts),
        "tool_policy": policy,
        "skipped": False,
    }
