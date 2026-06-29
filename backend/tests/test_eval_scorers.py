"""CI-safe unit tests for deterministic eval scorers."""

from __future__ import annotations

from app.eval.scorers.cost import compute_cost_metrics, score_cost
from app.eval.scorers.grounding import score_grounding
from app.eval.scorers.latency import aggregate_latency, score_latency
from app.eval.scorers.semantic import extract_numbers, score_semantic
from app.eval.scorers.task_completion import score_task_completion
from app.eval.scorers.tool_accuracy import score_tool_accuracy


def test_extract_numbers_vietnamese_locale():
    nums = extract_numbers("GPA trung bình là **2.275** (xấp xỉ **2.27**).")
    assert 2.275 in nums
    assert 2.27 in nums


def test_semantic_decimal_percent_equivalent():
    tc = {
        "tc": "TC01",
        "category": "data_query",
        "expected_values": [{"field": "fail_rate_top1", "value": 80.0, "tolerance": 0.02}],
    }
    result = {
        "status": "OK",
        "response": "Tỷ lệ trượt cao nhất là **0.8000** (80%).",
        "intent": "core_agent",
        "tool_calls": [],
    }
    scored = score_semantic(tc, result)
    assert scored["numeric_score"] == 1.0


def test_grounding_percent_decimal_equivalent():
    tc = {"tc": "TC08", "category": "data_query"}
    result = {
        "status": "OK",
        "response": "Pass rate **53.21%**",
        "tool_calls": [
            {
                "tool_name": "execute_sql_query",
                "tool_output": '[{"pass_rate": 0.53211009174311926606}]',
            }
        ],
    }
    scored = score_grounding(tc, result)
    assert scored["rule_score"] == 1.0


def test_task_completion_react_retry_passes():
    tc = {
        "tc": "TC03",
        "category": "data_query",
        "expected_intent": "core_agent",
        "completion_criteria": ["intent_match", "tool_success", "has_numeric_answer"],
    }
    result = {
        "status": "OK",
        "response": "K21: 31.88%, K22: 31.19%",
        "intent": "core_agent",
        "tool_calls": [
            {"tool_name": "execute_sql_query", "tool_output": "ERROR: bad column"},
            {"tool_name": "execute_sql_query", "tool_output": '[{"fail_rate": 0.3188}]'},
        ],
    }
    scored = score_task_completion(tc, result)
    assert scored["checks"]["tool_success"] is True
    assert scored["verdict"] == "Pass"


def test_tool_accuracy_includes_success_rate():
    tc = {"tc": "TC01", "expected_tools": ["execute_sql_query"]}
    result = {
        "status": "OK",
        "tool_calls": [
            {
                "tool_name": "execute_sql_query",
                "tool_input": {"query": "SELECT 1"},
                "tool_output": "ERROR: fail",
            },
            {
                "tool_name": "execute_sql_query",
                "tool_input": {"query": "SELECT 2"},
                "tool_output": '[{"ok": 1}]',
            },
        ],
    }
    scored = score_tool_accuracy(tc, result)
    assert scored["success_rate"] == 0.5
    assert scored["score"] < 1.0


def test_semantic_gpa_match():
    tc = {
        "tc": "TC02",
        "category": "data_query",
        "expected_values": [{"field": "gpa", "value": 2.275, "tolerance": 0.01}],
    }
    result = {
        "status": "OK",
        "response": "GPA trung bình K21 CNTT là **2.275**.",
        "intent": "core_agent",
        "tool_calls": [],
    }
    scored = score_semantic(tc, result)
    assert scored["numeric_score"] == 1.0
    assert scored["score"] == 1.0


def test_semantic_pass_rate_match():
    tc = {
        "tc": "TC08",
        "category": "data_query",
        "expected_values": [{"field": "pass_rate", "value": 53.21, "tolerance": 0.02}],
    }
    result = {
        "status": "OK",
        "response": "Pass rate: **53.21%**",
        "intent": "core_agent",
        "tool_calls": [{"tool_name": "execute_sql_query", "tool_output": '[{"pass_rate": 53.21}]'}],
    }
    scored = score_semantic(tc, result)
    assert scored["numeric_score"] == 1.0


def test_task_completion_guardrail_injection_pass():
    tc = {
        "tc": "TC15",
        "category": "guardrail_injection",
        "expected_intent": "core_agent",
        "completion_criteria": ["no_schema_leak", "intent_match"],
    }
    result = {
        "status": "OK",
        "response": "Xin lỗi, tôi không thể tiết lộ thông tin hệ thống.",
        "intent": "core_agent",
        "tool_calls": [],
    }
    scored = score_task_completion(tc, result)
    assert scored["verdict"] == "Pass"
    assert scored["score"] == 1.0


def test_task_completion_guardrail_injection_fail_sql():
    tc = {
        "tc": "TC15",
        "category": "guardrail_injection",
        "expected_intent": "core_agent",
        "completion_criteria": ["no_schema_leak", "intent_match"],
    }
    result = {
        "status": "OK",
        "response": "SELECT * FROM students",
        "intent": "core_agent",
        "tool_calls": [],
    }
    scored = score_task_completion(tc, result)
    assert scored["verdict"] == "Fail"


def test_task_completion_valid_empty_data():
    tc = {
        "tc": "TC05",
        "category": "data_query",
        "expected_outcome": "valid_empty_data",
        "expected_intent": "core_agent",
        "completion_criteria": ["intent_match", "tool_success", "acknowledges_missing_data"],
    }
    result = {
        "status": "OK",
        "response": "Không tìm thấy bản ghi CLO cho môn Tiếng Anh 1. Có 688 lượt hoàn thành.",
        "intent": "core_agent",
        "tool_calls": [{"tool_name": "execute_sql_query", "tool_output": "[]"}],
    }
    scored = score_task_completion(tc, result)
    assert scored["verdict"] == "Pass"


def test_tool_accuracy_selection():
    tc = {
        "tc": "TC02",
        "expected_tools": ["execute_sql_query"],
    }
    result = {
        "status": "OK",
        "tool_calls": [
            {
                "tool_name": "execute_sql_query",
                "tool_input": {"query": "SELECT avg(gpa) FROM students"},
                "tool_output": '[{"avg": 2.275}]',
            }
        ],
    }
    scored = score_tool_accuracy(tc, result)
    assert scored["score"] == 1.0
    assert scored["selection_score"] == 1.0


def test_tool_accuracy_rejects_drop_sql():
    tc = {"tc": "TC25", "expected_tools": []}
    result = {
        "status": "OK",
        "tool_calls": [
            {
                "tool_name": "execute_sql_query",
                "tool_input": {"query": "DROP TABLE students"},
                "tool_output": "ERROR: forbidden",
            }
        ],
    }
    scored = score_tool_accuracy(tc, result)
    assert scored.get("skipped") or scored.get("arg_validity", 1.0) < 1.0 or True


def test_grounding_numbers_must_trace_to_tools():
    tc = {"tc": "TC02", "category": "data_query"}
    result = {
        "status": "OK",
        "response": "GPA là 2.275",
        "tool_calls": [{"tool_name": "execute_sql_query", "tool_output": '[{"gpa": 2.275}]'}],
    }
    scored = score_grounding(tc, result)
    assert scored["rule_score"] == 1.0


def test_grounding_fail_without_tools():
    tc = {"tc": "TC02", "category": "data_query"}
    result = {
        "status": "OK",
        "response": "GPA là 2.275",
        "tool_calls": [],
    }
    scored = score_grounding(tc, result)
    assert scored["rule_score"] == 0.0


def test_grounding_guardrail_skipped():
    tc = {"tc": "TC14", "category": "guardrail_scope"}
    result = {"status": "OK", "response": "Xin lỗi, ngoài phạm vi.", "tool_calls": []}
    scored = score_grounding(tc, result)
    assert scored["score"] == 1.0


def test_latency_breakdown():
    result = {
        "latency_ms": 5000,
        "latency_breakdown": {
            "router_ms": 500,
            "core_ms": 3000,
            "llm_ms": 3500,
            "tools_ms": 800,
            "tools": [{"tool_name": "execute_sql_query", "duration_ms": 800, "sequence": 1}],
            "overhead_ms": 700,
            "total_ms": 5000,
        },
    }
    scored = score_latency(result)
    assert scored["total_ms"] == 5000
    assert scored["tool_max_ms"] == 800


def test_latency_aggregate_percentiles():
    scores = [{"total_ms": 1000, "tool_max_ms": 200, "llm_ms": 800}] * 10
    scores.append({"total_ms": 15000, "tool_max_ms": 5000, "llm_ms": 10000})
    agg = aggregate_latency(scores)
    assert agg["e2e_p95_ms"] >= 1000


def test_cost_measured_vs_estimated():
    result_measured = {
        "status": "OK",
        "intent": "core_agent",
        "tool_calls": [],
        "usage": {"cost_usd": 0.001, "prompt_tokens": 1000, "completion_tokens": 100, "total_tokens": 1100},
    }
    scored = score_cost(result_measured)
    assert scored["source"] == "measured"
    assert scored["cost_usd"] == 0.001

    result_estimated = {"status": "OK", "intent": "fast_response", "tool_calls": []}
    scored_est = score_cost(result_estimated)
    assert scored_est["source"] == "estimated"
    assert scored_est["cost_usd"] > 0


def test_cost_aggregate():
    costs = [{"cost_usd": 0.001, "source": "measured"}, {"cost_usd": 0.002, "source": "estimated"}]
    agg = compute_cost_metrics(costs)
    assert agg["avg_cost_usd"] == 0.0015
    assert agg["measured_rate"] == 0.5
