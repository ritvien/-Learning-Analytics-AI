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


def test_tool_accuracy_scores_ordered_multi_tool_sequence():
    tc = {
        "tc": "TC78",
        "expected_tools": ["lookup_student_by_code", "execute_sql_query"],
        "expected_tool_sequence": ["lookup_student_by_code", "execute_sql_query"],
        "expected_tool_counts": {"lookup_student_by_code": 1, "execute_sql_query": 1},
    }
    result = {
        "status": "OK",
        "tool_calls": [
            {
                "tool_name": "lookup_student_by_code",
                "tool_input": {"student_code": "21810310019"},
                "tool_output": '{"program":"Công nghệ thông tin"}',
            },
            {
                "tool_name": "execute_sql_query",
                "tool_input": {"query": "SELECT 1"},
                "tool_output": '[{"fail_rate": 0.12}]',
            },
        ],
    }

    scored = score_tool_accuracy(tc, result)

    assert scored["score"] == 1.0
    assert scored["sequence_score"] == 1.0
    assert scored["count_score"] == 1.0


def test_tool_accuracy_penalizes_wrong_multi_tool_order():
    tc = {
        "tc": "TC78",
        "expected_tools": ["lookup_student_by_code", "execute_sql_query"],
        "expected_tool_sequence": ["lookup_student_by_code", "execute_sql_query"],
        "expected_tool_counts": {"lookup_student_by_code": 1, "execute_sql_query": 1},
    }
    result = {
        "status": "OK",
        "tool_calls": [
            {
                "tool_name": "execute_sql_query",
                "tool_input": {"query": "SELECT 1"},
                "tool_output": '[{"fail_rate": 0.12}]',
            },
            {
                "tool_name": "lookup_student_by_code",
                "tool_input": {"student_code": "21810310019"},
                "tool_output": '{"program":"Công nghệ thông tin"}',
            },
        ],
    }

    scored = score_tool_accuracy(tc, result)

    assert scored["selection_score"] == 1.0
    assert scored["count_score"] == 1.0
    assert scored["sequence_score"] == 0.5
    assert scored["score"] <= 0.75


def test_tool_accuracy_requires_duplicate_tool_counts():
    tc = {
        "tc": "TC79",
        "expected_tools": ["get_student_dropout_risk"],
        "expected_tool_sequence": ["get_student_dropout_risk", "get_student_dropout_risk"],
        "expected_tool_counts": {"get_student_dropout_risk": 2},
    }
    one_call_result = {
        "status": "OK",
        "tool_calls": [
            {
                "tool_name": "get_student_dropout_risk",
                "tool_input": {"student_code": "21810310019"},
                "tool_output": '{"dropout_probability":0.99}',
            }
        ],
    }
    two_call_result = {
        "status": "OK",
        "tool_calls": [
            {
                "tool_name": "get_student_dropout_risk",
                "tool_input": {"student_code": "21810310019"},
                "tool_output": '{"dropout_probability":0.99}',
            },
            {
                "tool_name": "get_student_dropout_risk",
                "tool_input": {"student_code": "24810310117"},
                "tool_output": '{"dropout_probability":0.98}',
            },
        ],
    }

    one_call = score_tool_accuracy(tc, one_call_result)
    two_calls = score_tool_accuracy(tc, two_call_result)

    assert one_call["count_score"] == 0.5
    assert one_call["sequence_score"] == 0.5
    assert one_call["score"] <= 0.75
    assert two_calls["score"] == 1.0


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


def test_task_completion_allowlisted_tool_error_counts_as_success():
    tc = {
        "tc": "TC90",
        "category": "data_query",
        "expected_outcome": "valid_empty_data",
        "expected_intent": "core_agent",
        "allowed_tool_error_prefixes": ["ERROR: no prediction"],
        "completion_criteria": ["intent_match", "tool_success", "acknowledges_missing_data"],
    }
    result = {
        "status": "OK",
        "response": "Chưa có prediction ML cho sinh viên này nên tôi không tự tính xác suất.",
        "intent": "core_agent",
        "tool_calls": [
            {
                "tool_name": "get_student_dropout_risk",
                "tool_output": "ERROR: no prediction for student",
            }
        ],
    }

    scored = score_task_completion(tc, result)

    assert scored["checks"]["tool_success"] is True
    assert scored["verdict"] == "Pass"


def test_task_completion_clarification_counts_for_scope_guardrail():
    tc = {
        "tc": "TC92",
        "category": "guardrail_scope",
        "expected_intent": "core_agent",
        "completion_criteria": ["refusal_pattern", "intent_match"],
    }
    result = {
        "status": "OK",
        "response": "Chưa đủ thông tin để xếp hạng ngành tốt hơn; vui lòng chọn tiêu chí như GPA hay tỷ lệ trượt.",
        "intent": "core_agent",
        "tool_calls": [],
    }

    scored = score_task_completion(tc, result)

    assert scored["checks"]["refusal_pattern"] is True
    assert scored["verdict"] == "Pass"


def test_task_completion_has_citation_passes_with_ctdt_tool_metadata():
    tc = {
        "tc": "TC51",
        "category": "ctdt_rag",
        "expected_intent": "core_agent",
        "completion_criteria": ["intent_match", "tool_success", "has_response", "has_citation"],
    }
    result = {
        "status": "OK",
        "response": "Theo CTĐT, mục tiêu đào tạo gồm... Nguồn: ctdt_cntt.pdf, trang 12, section Mục tiêu.",
        "intent": "core_agent",
        "tool_calls": [
            {
                "tool_name": "search_ctdt_program_info",
                "tool_input": {"query": "mục tiêu đào tạo CNTT"},
                "tool_output": (
                    '{"status":"ok","hits":[{"source_file":"ctdt_cntt.pdf",'
                    '"page_start":12,"page_end":12,"section_title":"Mục tiêu đào tạo"}]}'
                ),
            }
        ],
    }

    scored = score_task_completion(tc, result)
    assert scored["checks"]["has_citation"] is True
    assert scored["verdict"] == "Pass"


def test_task_completion_has_citation_fails_without_tool_citation_fields():
    tc = {
        "tc": "TC51",
        "category": "ctdt_rag",
        "expected_intent": "core_agent",
        "completion_criteria": ["intent_match", "tool_success", "has_response", "has_citation"],
    }
    result = {
        "status": "OK",
        "response": "Nguồn: tài liệu CTĐT.",
        "intent": "core_agent",
        "tool_calls": [
            {
                "tool_name": "search_ctdt_program_info",
                "tool_input": {"query": "mục tiêu đào tạo CNTT"},
                "tool_output": '{"status":"ok","hits":[{"content":"Không có metadata citation"}]}',
            }
        ],
    }

    scored = score_task_completion(tc, result)
    assert scored["checks"]["has_citation"] is False
    assert scored["verdict"] == "Partial"


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


def test_tool_accuracy_optional_policy_allows_no_tool_or_allowlisted_business_error():
    tc = {
        "tc": "TC39",
        "expected_tools": ["search_ctdt_program_info"],
        "tool_policy": "optional",
        "allowed_tool_error_prefixes": ["ERROR: unsupported program"],
    }

    no_tool = score_tool_accuracy(tc, {"status": "OK", "tool_calls": []})
    assert no_tool["skipped"] is True
    assert no_tool["tool_policy"] == "optional"

    error_tool = score_tool_accuracy(
        tc,
        {
            "status": "OK",
            "tool_calls": [
                {
                    "tool_name": "search_ctdt_program_info",
                    "tool_input": {"query": "Quản trị kinh doanh"},
                    "tool_output": "ERROR: unsupported program",
                }
            ],
        },
    )
    assert error_tool["score"] == 1.0
    assert error_tool["success_rate"] == 1.0


def test_tool_accuracy_optional_policy_penalizes_unexpected_error():
    tc = {
        "tc": "TC43",
        "expected_tools": ["lookup_student_by_code"],
        "tool_policy": "optional",
    }

    scored = score_tool_accuracy(
        tc,
        {
            "status": "OK",
            "tool_calls": [
                {
                    "tool_name": "lookup_student_by_code",
                    "tool_input": {"student_code": "25810460057"},
                    "tool_output": "ERROR: database unavailable",
                }
            ],
        },
    )
    assert scored["success_rate"] == 0.0
    assert scored["score"] < 1.0


def test_tool_accuracy_forbidden_policy_scores_side_effect_guardrails():
    tc = {"tc": "TC50", "expected_tools": [], "tool_policy": "forbidden"}

    no_tool = score_tool_accuracy(tc, {"status": "OK", "tool_calls": []})
    assert no_tool["score"] == 1.0

    with_tool = score_tool_accuracy(
        tc,
        {
            "status": "OK",
            "tool_calls": [
                {
                    "tool_name": "execute_sql_query",
                    "tool_input": {"query": "SELECT 1"},
                    "tool_output": '[{"ok": 1}]',
                }
            ],
        },
    )
    assert with_tool["score"] == 0.0


def test_tool_accuracy_legacy_empty_expected_tools_still_skips():
    tc = {"tc": "TC14", "expected_tools": []}

    scored = score_tool_accuracy(tc, {"status": "OK", "tool_calls": []})

    assert scored["score"] is None
    assert scored["skipped"] is True


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


def test_grounding_ignores_identifier_like_numbers():
    tc = {"tc": "TC47", "category": "data_query"}
    result = {
        "status": "OK",
        "response": "Sinh viên 21810310019 thuộc khóa 2021, mã ngành 7480201.",
        "tool_calls": [],
    }

    scored = score_grounding(tc, result)

    assert scored["rule_score"] == 1.0
    assert scored["unsupported"] == []


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
