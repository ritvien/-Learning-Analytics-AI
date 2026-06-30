"""Integration tests for the report-agent endpoints."""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent import report_service
from app.agent.report_service import confirm_pending_action
from app.dependencies import create_access_token
from app.models.academic import Course, Department, Semester, University
from app.models.agent import ReportAgentPendingAction, ReportAgentSession, ReportAgentToolCall
from app.models.people import Teacher, User, UserRole
from app.models.report import Report
from app.models.teaching import Section


@pytest.fixture
async def sample_report(db_session: AsyncSession) -> Report:
    report = Report(
        id="report-agent-test",
        report_type="program_health",
        actor_role="manager",
        scope_type="program",
        scope_id="1",
        title="Program health test",
        summary="Pass rate needs review",
        status="generated",
        metrics_json={
            "pass_rate": 68.5,
            "completed_enrollments": 200,
            "passed_enrollments": 137,
            "issues": ["Pass rate below safe threshold"],
            "risks": ["Mức rủi ro: Cao"],
            "actions": ["Review bottleneck courses"],
        },
        content_markdown="# Program health test",
        generated_by="test-admin",
        created_at=datetime.now(UTC),
    )
    db_session.add(report)
    await db_session.flush()
    return report


@pytest.mark.asyncio
async def test_report_agent_tools(client: AsyncClient):
    response = await client.get("/api/v1/report-agent/tools")
    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert "get_report_snapshot" in names
    assert "list_report_scope_options" in names
    assert "list_my_teaching_sections" in names
    assert "create_task_from_report_action" in names


@pytest.mark.asyncio
async def test_report_agent_ask_explains_metric(client: AsyncClient, sample_report: Report):
    response = await client.post(
        "/api/v1/report-agent/ask",
        json={
            "report_id": sample_report.id,
            "message": "Giải thích chỉ số pass_rate tính như thế nào?",
            "mode": "explain",
            "context": {"metric_key": "pass_rate"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"]
    assert data["prompt_version"]
    assert "pass_rate" in str(data["tool_calls"])
    assert "Cách tính" in data["response"]


@pytest.mark.asyncio
async def test_report_agent_pending_action_confirmation(client: AsyncClient, sample_report: Report):
    ask_response = await client.post(
        "/api/v1/report-agent/ask",
        json={
            "report_id": sample_report.id,
            "message": "Tạo task xử lý vấn đề này",
            "mode": "action_planning",
        },
    )
    assert ask_response.status_code == 200
    pending = ask_response.json()["pending_actions"]
    assert pending

    confirm_response = await client.post(
        f"/api/v1/report-agent/tools/confirm/{pending[0]['id']}",
        json={"action": "confirm"},
    )
    assert confirm_response.status_code == 200
    assert confirm_response.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_report_build_plan_requires_confirmation_before_snapshot(client: AsyncClient):
    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "message": "Tạo báo cáo sức khỏe ngành cho phạm vi đang xem học kỳ 2025-2 để họp quản lý, trả về link trang báo cáo",
            "context": {
                "source": "global_chat",
                "scope": {"scope_type": "program", "scope_id": "1"},
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action_id"]
    assert data["requires_confirmation"] is True
    assert data["definition"]["report_type"] == "program_health"
    assert data["definition"]["scope_id"] == "1"
    assert data["definition"]["template_label"] == "Sức khỏe ngành và PLO"
    assert data["definition"]["visuals"]


@pytest.mark.asyncio
async def test_report_build_plan_asks_for_missing_context(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    async def fake_extract_report_build_intent(message, context, previous_definition):
        return {"intent_source": "rules_fallback"}

    monkeypatch.setattr(report_service, "_extract_report_build_intent", fake_extract_report_build_intent)
    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "message": "Tôi cần tạo báo cáo ngành CNTT",
            "context": {"source": "full_chat"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action_id"] is None
    assert data["data_quality"]["status"] == "incomplete"
    assert "scope_id" in data["missing_fields"]
    assert "period" in data["missing_fields"]
    assert "purpose" in data["missing_fields"]
    assert "output_format" not in data["missing_fields"]
    assert "chưa tìm thấy ngành" in data["message"].lower()
    assert "Công nghệ thông tin" in data["message"]


@pytest.mark.asyncio
async def test_report_build_plan_accumulates_brief_across_turns(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
):
    async def fake_extract_report_build_intent(message, context, previous_definition):
        return {"intent_source": "rules_fallback"}

    monkeypatch.setattr(report_service, "_extract_report_build_intent", fake_extract_report_build_intent)
    university = University(id=1, code="VIN", name="VinUni", is_active=True)
    department = Department(
        id=11,
        university_id=1,
        code="CECS",
        name="Công nghệ thông tin",
        name_en="Computer Science",
        is_active=True,
    )
    db_session.add_all([university, department])
    await db_session.flush()

    discovery = await client.post(
        "/api/v1/report-agent/build/plan",
        json={"message": "hỗ trợ build báo cáo", "context": {"source": "full_chat"}},
    )
    assert discovery.status_code == 200
    session_id = discovery.json()["session_id"]
    assert discovery.json()["missing_fields"]

    scope_turn = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "session_id": session_id,
            "message": "sức khỏe khoa công nghệ thông tin",
            "context": {"source": "full_chat"},
        },
    )
    assert scope_turn.status_code == 200
    scope_data = scope_turn.json()
    assert scope_data["definition"]["report_type"] == "department_health"
    assert scope_data["definition"]["scope_id"] == "11"
    assert "period" in scope_data["missing_fields"]
    assert "purpose" in scope_data["missing_fields"]

    final_turn = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "session_id": session_id,
            "message": "Thời gian: năm 2022; Mục tiêu: họp quản lý; Bộ lọc: GPA, tỷ lệ trượt, SV nguy cơ",
            "context": {"source": "full_chat"},
        },
    )
    assert final_turn.status_code == 200
    data = final_turn.json()
    assert data["action_id"]
    assert data["definition"]["report_type"] == "department_health"
    assert data["definition"]["scope_type"] == "department"
    assert data["definition"]["scope_id"] == "11"
    assert data["missing_fields"] == []


@pytest.mark.asyncio
async def test_report_build_plan_school_overview_keeps_base_template_label(client: AsyncClient):
    discovery = await client.post(
        "/api/v1/report-agent/build/plan",
        json={"message": "hỗ trợ build báo cáo", "context": {"source": "full_chat"}},
    )
    assert discovery.status_code == 200

    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "session_id": discovery.json()["session_id"],
            "message": "tổng quan trường",
            "context": {
                "source": "full_chat",
                "custom_request": "hỗ trợ build báo cáo\nThông tin bổ sung: tổng quan trường",
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["definition"]["report_type"] == "school_overview"
    assert data["definition"]["scope_type"] == "school"
    assert data["definition"]["template_label"] == "Tóm tắt điều hành toàn trường"
    assert data["definition"]["is_custom"] is False
    assert "period" in data["missing_fields"]


@pytest.mark.asyncio
async def test_report_build_plan_answers_permission_question_without_context_card(client: AsyncClient):
    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={"message": "thế tôi có quyền gì", "context": {"source": "full_chat"}},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["action_id"] is None
    assert data["requires_confirmation"] is False
    assert data["data_quality"]["status"] == "permission_info"
    assert "Bạn có quyền" in data["message"]
    assert data["missing_fields"] == []


@pytest.mark.asyncio
async def test_report_build_plan_uses_llm_followup_question(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    calls: list[dict] = []

    async def fake_followup_question(message, definition, missing_fields):
        calls.append({"message": message, "definition": definition, "missing_fields": missing_fields})
        return "Mình đã hiểu bạn muốn báo cáo tổng quan toàn trường. Bạn muốn lấy dữ liệu cho học kỳ nào?"

    monkeypatch.setattr(report_service, "_build_report_followup_question", fake_followup_question)
    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={"message": "báo cáo về tổng quan trường đi", "context": {"source": "full_chat"}},
    )
    assert response.status_code == 200
    data = response.json()
    assert calls
    assert data["action_id"] is None
    assert data["definition"]["report_type"] == "school_overview"
    assert data["definition"]["template_label"] == "Tóm tắt điều hành toàn trường"
    assert data["message"] == "Mình đã hiểu bạn muốn báo cáo tổng quan toàn trường. Bạn muốn lấy dữ liệu cho học kỳ nào?"


@pytest.mark.asyncio
async def test_report_build_plan_uses_llm_intent_extractor(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    calls: list[dict] = []

    async def fake_extract_report_build_intent(message, context, previous_definition):
        calls.append({"message": message, "context": context, "previous_definition": previous_definition})
        return {
            "report_type": "school_overview",
            "scope": {"scope_type": "school", "scope_label": "Toàn trường"},
            "period_label": "Năm 2022",
            "purpose": "Họp quản lý",
            "filters": {"focus": ["GPA", "Tỷ lệ trượt"]},
            "intent_confidence": 91,
            "intent_rationale": "Người dùng muốn một báo cáo tổng quan để họp quản lý.",
        }

    monkeypatch.setattr(report_service, "_extract_report_build_intent", fake_extract_report_build_intent)
    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "message": "làm giúp tôi báo cáo số 5",
            "context": {"source": "full_chat"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert calls
    assert data["action_id"]
    assert data["definition"]["report_type"] == "school_overview"
    assert data["definition"]["scope_type"] == "school"
    assert data["definition"]["period_label"] == "Năm 2022"
    assert data["definition"]["purpose"] == "Họp quản lý"
    assert data["definition"]["filters"] == {"focus": ["GPA", "Tỷ lệ trượt"]}
    assert data["definition"]["intent_source"] == "llm"
    assert data["definition"]["intent_confidence"] == 91
    assert "tổng quan" in data["definition"]["intent_rationale"]
    assert data["missing_fields"] == []


@pytest.mark.asyncio
async def test_report_build_plan_llm_understands_accreditation_and_quality_comparison(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
):
    async def fake_extract_report_build_intent(message, context, previous_definition):
        return {
            "report_type": "school_overview",
            "scope": {"scope_type": "school", "scope_label": "Toàn trường"},
            "period_label": "Học kỳ hiện tại",
            "purpose": "Minh chứng kiểm định và so sánh chất lượng đào tạo",
            "audience": "Hội đồng kiểm định",
            "decision": "Chọn các điểm cần cải thiện trước kỳ đánh giá",
            "comparison": "So sánh chất lượng giữa các khoa và với kỳ trước",
            "filters": {"focus": ["PLO/CLO", "GPA", "Tỷ lệ đạt", "Xu hướng chất lượng"]},
            "intent_confidence": 94,
            "intent_rationale": "Cụm kiểm định và so sánh chất lượng thể hiện mục tiêu đảm bảo chất lượng, không chỉ là bộ lọc.",
        }

    monkeypatch.setattr(report_service, "_extract_report_build_intent", fake_extract_report_build_intent)
    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "message": "Tạo báo cáo phục vụ kiểm định và so sánh chất lượng học kỳ hiện tại",
            "context": {"source": "full_chat"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    definition = data["definition"]
    assert data["action_id"]
    assert definition["intent_source"] == "llm"
    assert definition["purpose"] == "Minh chứng kiểm định và so sánh chất lượng đào tạo"
    assert definition["audience"] == "Hội đồng kiểm định"
    assert definition["decision"] == "Chọn các điểm cần cải thiện trước kỳ đánh giá"
    assert definition["comparison"] == "So sánh chất lượng giữa các khoa và với kỳ trước"
    assert definition["filters"]["focus"] == ["PLO/CLO", "GPA", "Tỷ lệ đạt", "Xu hướng chất lượng"]
    assert definition["intent_confidence"] == 94
    assert "đảm bảo chất lượng" in definition["intent_rationale"]


@pytest.mark.asyncio
async def test_report_build_plan_rejects_non_numeric_scope_id(client: AsyncClient):
    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "message": "Tạo báo cáo sức khỏe ngành học kỳ 2025-2 để họp quản lý",
            "context": {
                "source": "global_chat",
                "scope": {"scope_type": "program", "scope_id": "1 OR 1=1"},
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action_id"] is None
    assert data["definition"]["scope_id"] is None
    assert "scope_id" in data["missing_fields"]


@pytest.mark.asyncio
async def test_report_confirm_rejects_tampered_report_definition(
    client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
):
    async def fail_generate_report(*args, **kwargs):
        raise AssertionError("generate_report must not be called for invalid report definitions")

    monkeypatch.setattr(report_service, "generate_report", fail_generate_report)
    user = await db_session.get(User, "test-admin")
    assert user is not None
    session = ReportAgentSession(
        user_id=user.id,
        title="Tampered report action",
        mode="workflow",
        scope_json={},
    )
    db_session.add(session)
    await db_session.flush()
    action = ReportAgentPendingAction(
        session_id=session.id,
        user_id=user.id,
        action_type="create_report_snapshot",
        payload_json={
            "definition": {
                "report_type": "program_health; DROP TABLE reports",
                "scope_type": "program",
                "scope_id": "1",
            }
        },
        result_json={},
    )
    db_session.add(action)
    await db_session.flush()

    with pytest.raises(ValueError, match="unsupported report_type"):
        await confirm_pending_action(db_session, user, action.id, "confirm")


@pytest.mark.asyncio
async def test_report_build_plan_guides_vague_report_request(client: AsyncClient):
    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "message": "build cho tôi cái báo cáo nào",
            "context": {"source": "full_chat"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action_id"] is None
    assert data["data_quality"]["status"] == "needs_discovery"
    assert data["definition"]["report_type"] is None
    assert data["definition"]["template_label"] == "Chưa chọn loại báo cáo"
    assert "report_type" in data["missing_fields"]
    assert "Loại báo cáo" in data["message"]
    assert "Bộ lọc" in data["message"]


@pytest.mark.asyncio
async def test_report_build_plan_user_scope_overrides_stale_context(client: AsyncClient):
    response = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "message": "Bạn giúp tôi build report tổng quan trường đi",
            "context": {
                "source": "full_chat",
                "scope": {"scope_type": "program", "scope_id": "3"},
                "semester_id": 18,
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["action_id"]
    assert data["requires_confirmation"] is True
    assert data["definition"]["report_type"] == "school_overview"
    assert data["definition"]["scope_type"] == "school"
    assert data["definition"]["scope_id"] is None
    assert data["definition"]["scope_hint"] == "Toàn trường"
    assert data["missing_fields"] == []
    assert "program" not in data["message"]
    assert "output_format" not in data["missing_fields"]


@pytest.mark.parametrize(
    ("message", "expected_hint"),
    [
        ("báo cáo về các lớp tôi dạy", "Các lớp tôi dạy"),
        ("xem lớp mình dạy", "Các lớp tôi dạy"),
        ("báo cáo lớp đang dạy", "Các lớp tôi dạy"),
        ("báo cáo lóp học phần tôi giảng dạy", "Các lớp tôi dạy"),
        ("tôi đang dạy lớp nào", "Các lớp tôi dạy"),
    ],
)
def test_report_navigation_keywords_recognize_own_sections(message: str, expected_hint: str):
    assert report_service._infer_report_type(message, {}) == "section_intervention"
    assert report_service._extract_scope_hint(message, {}) == expected_hint


def test_report_navigation_keywords_recognize_tracking_purpose_and_year():
    brief = report_service._extract_report_brief("mục đích để theo dõi", {})
    assert brief["purpose"] == "Theo dõi tiến độ và kết quả lớp học phần"
    assert report_service._extract_period_label("kì 2022 đi") == "Năm 2022"


@pytest.mark.parametrize(
    ("message", "expected_type"),
    [
        ("báo cáo các ngành trong khoa tôi", "program_health"),
        ("báo cáo các môn thuộc khoa tôi", "course_health"),
        ("báo cáo các lớp học phần thuộc khoa tôi", "section_intervention"),
        ("báo cáo khoa của tôi", "department_health"),
    ],
)
def test_report_navigation_prefers_requested_child_scope(message: str, expected_type: str):
    assert report_service._infer_report_type(message, {}) == expected_type


@pytest.mark.parametrize("hint", ["tôi", "mình", "ngành của tôi", "các môn tôi dạy"])
def test_report_navigation_treats_actor_relative_scope_as_queryable_options(hint: str):
    assert report_service._scope_search_hint({"scope_hint": hint}) is None


def test_report_navigation_keeps_own_teaching_scope_when_llm_returns_generic_label():
    previous = {"scope_owner": "current_user_teaching", "scope_type": "section"}
    generic_llm_scope = {"scope_type": "section", "scope_label": "Lớp học phần cần xác định"}

    assert report_service._should_use_own_teaching_scope("học kì đi", previous, generic_llm_scope)
    assert report_service._should_use_own_teaching_scope(
        "nawm 2022",
        {"scope_hint": "Các lớp tôi dạy", "scope_type": "section"},
        generic_llm_scope,
    )
    assert not report_service._should_use_own_teaching_scope("báo cáo tổng quan trường", previous, {})


@pytest.mark.asyncio
async def test_report_build_navigation_lists_only_lecturer_sections_and_accepts_selection(
    client: AsyncClient,
    db_session: AsyncSession,
):
    university = University(code="NAV-U", name="Navigation University")
    db_session.add(university)
    await db_session.flush()
    department = Department(
        university_id=university.id,
        code="NAV-D",
        name="Khoa Kỹ thuật",
        is_active=True,
    )
    db_session.add(department)
    await db_session.flush()
    course_a = Course(department_id=department.id, code="NAV101", name="Nhập môn dữ liệu", credits=3)
    course_b = Course(department_id=department.id, code="NAV102", name="Phân tích dữ liệu", credits=3)
    other_course = Course(department_id=department.id, code="NAV999", name="Lớp không thuộc quyền", credits=3)
    semester = Semester(code="NAV-2022-1", name="Học kỳ 1 năm 2022", year=2022, term=1, is_current=True)
    db_session.add_all([course_a, course_b, other_course, semester])
    await db_session.flush()

    lecturer = User(
        id="navigation-lecturer",
        email="navigation.lecturer@example.com",
        hashed_password="x",
        full_name="Navigation Lecturer",
        role=UserRole.lecturer,
        department_id=department.id,
    )
    other_user = User(
        id="navigation-other-lecturer",
        email="navigation.other@example.com",
        hashed_password="x",
        full_name="Other Lecturer",
        role=UserRole.lecturer,
        department_id=department.id,
    )
    db_session.add_all([lecturer, other_user])
    await db_session.flush()
    teacher = Teacher(
        user_id=lecturer.id,
        department_id=department.id,
        code="NAV-T1",
        full_name=lecturer.full_name,
    )
    other_teacher = Teacher(
        user_id=other_user.id,
        department_id=department.id,
        code="NAV-T2",
        full_name=other_user.full_name,
    )
    db_session.add_all([teacher, other_teacher])
    await db_session.flush()
    own_section_a = Section(
        course_id=course_a.id,
        semester_id=semester.id,
        teacher_id=teacher.id,
        section_code="NAV101-01",
    )
    own_section_b = Section(
        course_id=course_b.id,
        semester_id=semester.id,
        teacher_id=teacher.id,
        section_code="NAV102-01",
    )
    other_section = Section(
        course_id=other_course.id,
        semester_id=semester.id,
        teacher_id=other_teacher.id,
        section_code="NAV999-01",
    )
    db_session.add_all([own_section_a, own_section_b, other_section])
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    discovery = await client.post(
        "/api/v1/report-agent/build/plan",
        json={"message": "build cho tôi cái báo cáo nào", "context": {"source": "full_chat"}},
    )
    assert discovery.status_code == 200
    session_id = discovery.json()["session_id"]

    scope_turn = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "session_id": session_id,
            "message": "báo cáo lóp học phần tôi giảng dạy",
            "context": {"source": "full_chat"},
        },
    )
    assert scope_turn.status_code == 200
    scope_data = scope_turn.json()
    assert scope_data["definition"]["scope_hint"] == "Các lớp tôi dạy"
    assert {option["id"] for option in scope_data["definition"]["scope_options"]} == {
        str(own_section_a.id),
        str(own_section_b.id),
    }

    period_turn = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "session_id": session_id,
            "message": "học kì đi",
            "context": {"source": "full_chat"},
        },
    )
    assert period_turn.status_code == 200
    period_data = period_turn.json()
    assert period_data["definition"]["scope_hint"] == "Các lớp tôi dạy"
    assert len(period_data["definition"]["scope_options"]) == 2

    list_turn = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "session_id": session_id,
            "message": "tôi đang dạy lớp nào",
            "context": {"source": "full_chat"},
        },
    )
    assert list_turn.status_code == 200
    list_data = list_turn.json()
    assert "Hãy chọn một lớp học phần bên dưới" in list_data["message"]
    assert {option["id"] for option in list_data["definition"]["scope_options"]} == {
        str(own_section_a.id),
        str(own_section_b.id),
    }

    purpose_turn = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "session_id": session_id,
            "message": "bộ lọc cho lớp tôi dạy, mục đích để theo dõi",
            "context": {"source": "full_chat"},
        },
    )
    assert purpose_turn.status_code == 200
    purpose_data = purpose_turn.json()
    assert purpose_data["missing_fields"] == ["scope_id"]
    assert "Hãy chọn một lớp học phần bên dưới" in purpose_data["message"]
    options = purpose_data["definition"]["scope_options"]
    assert {option["id"] for option in options} == {str(own_section_a.id), str(own_section_b.id)}
    assert all("NAV999" not in option["label"] for option in options)

    tool_calls = list(
        (
            await db_session.execute(
                select(ReportAgentToolCall).where(
                    ReportAgentToolCall.session_id == session_id,
                    ReportAgentToolCall.tool_name == "list_report_scope_options",
                )
            )
        ).scalars()
    )
    assert tool_calls
    assert set(tool_calls[-1].tool_output_json["scope_ids"]) == {
        str(own_section_a.id),
        str(own_section_b.id),
    }

    selected = options[0]
    selection_turn = await client.post(
        "/api/v1/report-agent/build/plan",
        json={
            "session_id": session_id,
            "message": f"Chọn lớp {selected['label']}",
            "context": {
                "source": "full_chat",
                "scope": {
                    "scope_type": "section",
                    "scope_id": selected["id"],
                    "scope_label": selected["label"],
                },
            },
        },
    )
    assert selection_turn.status_code == 200
    selection_data = selection_turn.json()
    assert selection_data["action_id"]
    assert selection_data["missing_fields"] == []
    assert selection_data["definition"]["scope_id"] == selected["id"]
