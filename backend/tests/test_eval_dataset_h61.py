"""Regression checks for the H61 expanded agent-eval dataset."""

from __future__ import annotations

from app.eval.dataset_loader import load_test_cases


def test_h61_eval_dataset_has_100_contiguous_cases():
    cases = load_test_cases()

    assert len(cases) == 100
    assert [case["tc"] for case in cases] == [f"TC{i:02d}" for i in range(1, 101)]


def test_h61_cases_have_feature_owner_and_expected_source_mapping():
    cases = {case["tc"]: case for case in load_test_cases()}
    h61_cases = [cases[f"TC{i:02d}"] for i in range(36, 101)]

    for case in h61_cases:
        assert case["owner"] == "H61"
        assert case["feature"]
        assert case["expected_source"]

    features = {case["feature"] for case in h61_cases}
    assert {
        "ctdt_rag_citation",
        "ctdt_unsupported_program_refusal",
        "no_ctdt_for_personal_clo",
        "dropout_missing_prediction",
        "dropout_ready_prediction",
        "cross_scope_student_refusal",
        "report_clo_plo_summary",
        "clo_lineage_warning",
        "thin_sample_warning",
        "student_lookup_scope",
        "multi_program_aggregation",
        "ctdt_curriculum_structure",
        "no_side_effect_action",
        "ctdt_multi_program_citation",
        "dropout_explain_prediction",
        "student_email_bulk_privacy_refusal",
        "abbreviation_alias_sql_recovery",
        "lookup_then_program_fail_rate",
        "compare_two_dropout_predictions",
        "ctdt_then_sql_internship_outcomes",
        "ctdt_it_adjacent_unsupported_program",
        "ctdt_multi_chunk_credit_synthesis",
        "no_diacritics_ctdt_query",
        "legitimate_empty_or_zero_result",
    } <= features


def test_h61_preserves_t55e_numeric_golden_values():
    cases = {case["tc"]: case for case in load_test_cases()}

    assert cases["TC28"]["expected_values"] == [
        {"field": "dropout_probability", "value": 0.99991, "tolerance": 0.001}
    ]
    assert cases["TC30"]["input"].startswith("Mức độ rủi ro dropout ML của sinh viên 24810310117")
    assert cases["TC30"]["expected_values"] == [
        {"field": "dropout_probability", "value": 0.99992, "tolerance": 0.001}
    ]
    assert cases["TC42"]["expected_values"] == [
        {"field": "dropout_probability", "value": 0.99991, "tolerance": 0.001}
    ]


def test_h61_ctdt_success_cases_require_rag_tool_and_citation_check():
    cases = {case["tc"]: case for case in load_test_cases()}
    grounded_ctdt_ids = {"TC36", "TC37", "TC38", "TC49", "TC51", "TC52", "TC53", "TC54"}

    for tc_id in grounded_ctdt_ids:
        case = cases[tc_id]
        assert case["category"] == "ctdt_rag"
        assert case["expected_tools"] == ["search_ctdt_program_info"]
        assert case["tool_policy"] == "required"
        assert case["expected_outcome"] == "grounded_ctdt_answer"
        assert "tool_success" in case["completion_criteria"]
        assert "has_citation" in case["completion_criteria"]
        assert any(keyword.lower() in {"nguồn", "trang", "section"} for keyword in case["expected_keywords"])


def test_h61_tool_policy_marks_optional_and_forbidden_paths():
    cases = {case["tc"]: case for case in load_test_cases()}

    assert cases["TC39"]["expected_tools"] == ["search_ctdt_program_info"]
    assert cases["TC39"]["tool_policy"] == "optional"
    assert cases["TC39"]["allowed_tool_error_prefixes"] == ["ERROR: unsupported program"]

    assert cases["TC40"]["feature"] == "no_ctdt_for_personal_clo"
    assert cases["TC40"]["expected_tools"] == []
    assert cases["TC40"]["tool_policy"] == "forbidden"

    assert cases["TC43"]["expected_tools"] == ["lookup_student_by_code"]
    assert cases["TC43"]["tool_policy"] == "optional"

    assert cases["TC50"]["expected_tools"] == []
    assert cases["TC50"]["tool_policy"] == "forbidden"

    assert cases["TC56"]["expected_tools"] == []
    assert cases["TC56"]["tool_policy"] == "forbidden"


def test_h61_100_blocks_non_runnable_backlog_cases_from_dataset():
    cases = load_test_cases()
    all_inputs = "\n".join(case["input"] for case in cases).lower()

    assert "top at-risk" not in all_inputs
    assert "manager ngoài" not in all_inputs
    assert "tóm tắt câu trả lời trước" not in all_inputs
    assert "shared thread" not in all_inputs


def test_h61_100_multitool_cases_have_order_and_counts():
    cases = {case["tc"]: case for case in load_test_cases()}

    assert cases["TC78"]["expected_tool_sequence"] == [
        "lookup_student_by_code",
        "execute_sql_query",
    ]
    assert cases["TC79"]["expected_tool_sequence"] == [
        "get_student_dropout_risk",
        "get_student_dropout_risk",
    ]
    assert cases["TC79"]["expected_tool_counts"] == {"get_student_dropout_risk": 2}
    assert cases["TC81"]["expected_tool_sequence"] == [
        "search_ctdt_program_info",
        "execute_sql_query",
    ]


def test_h61_100_r2_review_adjustments_are_present():
    cases = {case["tc"]: case for case in load_test_cases()}

    assert "00000000001" in cases["TC87"]["input"]
    assert "99999999999" not in cases["TC87"]["input"]
    assert "An toàn thông tin" in cases["TC91"]["input"]
    assert cases["TC92"]["expected_outcome"] == "clarification"
    assert cases["TC93"]["category"] == "ctdt_rag"
    assert cases["TC93"]["feature"] == "ctdt_multi_chunk_credit_synthesis"
