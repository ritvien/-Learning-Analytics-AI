"""Unit tests for T32 — CLO course-improvement enrichment (pure logic, no DB)."""

from app.reports.service import _apply_clo_enrichment, _build_clo_enrichment, _validate_llm_grounding


def _rows():
    # attainment_rate is a 0..1 ratio, as returned by the SQL AVG(CASE ...).
    return [
        {"clo_code": "CLO1", "clo_name": "Hiểu khái niệm", "sample": 40, "avg_score": 7.1, "attainment_rate": 0.85},
        {"clo_code": "CLO2", "clo_name": "Vận dụng", "sample": 40, "avg_score": 5.0, "attainment_rate": 0.55},
        {"clo_code": "CLO3", "clo_name": "Phân tích", "sample": 40, "avg_score": 4.2, "attainment_rate": 0.40},
    ]


def test_build_clo_enrichment_maps_attainment_and_flags_weak():
    result = _build_clo_enrichment(_rows())

    # All CLOs converted to 0..100 percentages.
    assert result["clo_attainment"] == {"CLO1": 85.0, "CLO2": 55.0, "CLO3": 40.0}

    # Only CLOs under 70% are weak, sorted worst-first.
    assert [w["code"] for w in result["weak_clos"]] == ["CLO3", "CLO2"]
    assert len(result["weak_clos"]) == 2

    # One improvement action per weak CLO, mentioning the CLO code.
    assert len(result["improvement_actions"]) == 2
    assert any("CLO3" in action for action in result["improvement_actions"])
    assert all("CLO1" not in action for action in result["improvement_actions"])


def test_build_clo_enrichment_empty_when_no_clo_data():
    assert _build_clo_enrichment([]) == {}
    assert _build_clo_enrichment([{"clo_code": "", "attainment_rate": None}]) == {}


def test_build_clo_enrichment_all_strong_has_no_actions():
    rows = [{"clo_code": "CLO1", "clo_name": "OK", "attainment_rate": 0.95}]
    result = _build_clo_enrichment(rows)
    assert result["clo_attainment"] == {"CLO1": 95.0}
    assert result["weak_clos"] == []
    assert result["improvement_actions"] == []


def test_apply_clo_enrichment_prepends_suggestions_and_keeps_existing():
    payload = {
        "title": "Báo cáo can thiệp lớp - SE101.1",
        "summary": "...",
        "metrics_json": {
            "section_code": "SE101.1",
            "pass_rate": 72.0,
            "issues": ["Có 3 sinh viên cần chú ý ngay."],
            "actions": ["Giảng viên lọc watchlist và liên hệ sinh viên trong tuần này."],
        },
        "content_markdown": "...",
    }
    enrichment = _build_clo_enrichment(_rows())
    out = _apply_clo_enrichment(payload, enrichment)
    metrics = out["metrics_json"]

    # CLO map injected for the frontend table.
    assert metrics["clo_attainment"]["CLO3"] == 40.0
    assert metrics["weak_clo_count"] == 2

    # Improvement issues/actions prepended, original items preserved.
    assert metrics["issues"][0].startswith("CLO3")
    assert metrics["issues"][-1] == "Có 3 sinh viên cần chú ý ngay."
    assert any("watchlist" in a for a in metrics["actions"])
    assert metrics["actions"][0].startswith("Cải thiện CLO3")


def test_validate_llm_grounding_accepts_numbers_from_metrics():
    payload = {
        "title": "Báo cáo môn học",
        "summary": "Tỷ lệ đạt 68.3% trên 120 lượt học.",
        "metrics_json": {"pass_rate": 68.3, "completed_enrollments": 120},
    }
    parsed = {
        "summary": "Môn học đạt 68.3% trên 120 lượt học, cần theo dõi thêm.",
        "issues": ["Tỷ lệ đạt 68.3% thấp hơn kỳ vọng."],
    }

    result = _validate_llm_grounding(parsed, payload, [])

    assert result["checked"] is True
    assert result["ungrounded_numbers"] == []


def test_validate_llm_grounding_flags_numbers_not_in_metrics():
    payload = {
        "title": "Báo cáo môn học",
        "summary": "Tỷ lệ đạt 68.3% trên 120 lượt học.",
        "metrics_json": {"pass_rate": 68.3, "completed_enrollments": 120},
    }
    parsed = {
        "summary": "Môn học đạt 68.3% nhưng có thêm 999 sinh viên rủi ro.",
        "issues": ["Cần kiểm tra con số 999 vì không có trong nguồn."],
    }

    result = _validate_llm_grounding(parsed, payload, [])

    assert "999" in result["ungrounded_numbers"]
