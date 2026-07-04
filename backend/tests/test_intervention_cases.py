"""Case workflow and actor-boundary coverage."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.interventions import _bulk_message
from app.dependencies import create_access_token, hash_password
from app.models.people import User, UserRole
from tests.test_homeroom_rbac import _seed_homeroom_data


def test_campaign_template_names_courses_and_risk_sources() -> None:
    message = _bulk_message(
        {
            "full_name": "Nguyễn Văn A",
            "student_code": "SV001",
            "gpa_cumulative": 1.95,
            "reasons": ["Có 2 lượt học phần chưa đạt"],
            "recommended_actions": ["Lập kế hoạch học lại"],
            "dropout_probability": 0.72,
            "scope_context": {
                "course_code": "IT101",
                "course_name": "Lập trình cơ bản",
                "section_code": "209",
                "semester_code": "2025-2",
                "current_grade": 4.2,
            },
            "academic_risk_details": [
                {
                    "course_code": "MATH101",
                    "course_name": "Giải tích 1",
                    "section_code": "105",
                    "semester_code": "2024-1",
                    "final_grade": 3.8,
                    "risk_label": "chưa đạt",
                }
            ],
        },
        "{scope_course}\n{risk_details}\nGPA {gpa}\nNguồn: {risk_sources}",
    )

    assert "IT101 - Lập trình cơ bản (lớp 209" in message
    assert "MATH101 - Giải tích 1 (lớp 105" in message
    assert "điểm tổng kết 3.8" in message
    assert "GPA 1.95" in message
    assert "mô hình ML nguy cơ gián đoạn học tập" in message


async def test_lecturer_case_is_unique_and_contact_updates_timeline(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    student = data["own_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    payload = {
        "student_id": student.id,
        "scope_type": "homeroom",
        "class_code": "K21-A",
        "priority": "high",
        "signal_snapshot": {"reasons": ["GPA thấp"]},
    }

    created = await client.post("/api/v1/interventions/cases", json=payload)
    duplicate = await client.post("/api/v1/interventions/cases", json=payload)
    case_id = created.json()["id"]
    contacted = await client.post(
        "/api/v1/interventions/contact",
        json={
            "case_id": case_id,
            "student_id": student.id,
            "class_code": "K21-A",
            "channel": "phone",
            "status": "logged",
            "note": "Đã hẹn trao đổi",
        },
    )
    detail = await client.get(f"/api/v1/interventions/cases/{case_id}")

    assert created.status_code == 201
    assert created.json()["assignee_user_id"] == lecturer.id
    assert duplicate.status_code == 409
    assert contacted.status_code == 201
    assert contacted.json()["case_id"] == case_id
    assert detail.json()["status"] == "contacting"
    assert {event["event_type"] for event in detail.json()["events"]} >= {"created", "contact"}


async def test_manager_can_monitor_but_cannot_contact_or_resolve(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    manager = data["manager"]
    student = data["own_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    created = await client.post(
        "/api/v1/interventions/cases",
        json={"student_id": student.id, "scope_type": "homeroom", "class_code": "K21-A"},
    )
    case_id = created.json()["id"]

    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"
    queue = await client.get("/api/v1/interventions/cases")
    resolve = await client.patch(f"/api/v1/interventions/cases/{case_id}", json={"status": "resolved"})
    contact = await client.post(
        "/api/v1/interventions/contact",
        json={"case_id": case_id, "student_id": student.id, "class_code": "K21-A", "channel": "email"},
    )

    assert queue.status_code == 200
    assert [item["id"] for item in queue.json()] == [case_id]
    assert queue.json()[0]["permissions"]["can_assign"] is True
    assert queue.json()[0]["permissions"]["can_contact"] is False
    assert resolve.status_code == 403
    assert contact.status_code == 403


async def test_lecturer_cannot_create_case_outside_homeroom(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    student = data["other_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    response = await client.post(
        "/api/v1/interventions/cases",
        json={"student_id": student.id, "scope_type": "homeroom", "class_code": "K21-B"},
    )

    assert response.status_code == 403


async def test_sync_materializes_scoped_risk_with_explainable_snapshot(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    student = data["own_student"]
    student.gpa_cumulative = 1.5
    await db_session.flush()
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"

    synced = await client.post("/api/v1/interventions/cases/sync-risk-signals?max_cases=10")
    queue = await client.get("/api/v1/interventions/cases")

    assert synced.status_code == 200
    assert synced.json()["created"] == 1
    assert len(queue.json()) == 1
    snapshot = queue.json()[0]["signal_snapshot"]
    assert snapshot["academic"]["gpa_cumulative"] == 1.5
    assert snapshot["dropout_ml"]["available"] is False
    assert snapshot["source"] == "academic_rules+predictions"


async def test_advisor_assessment_and_appointment_lifecycle(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    student = data["own_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    created = await client.post(
        "/api/v1/interventions/cases",
        json={"student_id": student.id, "scope_type": "homeroom", "class_code": "K21-A"},
    )
    case_id = created.json()["id"]

    assessment = await client.put(
        f"/api/v1/interventions/cases/{case_id}/assessment",
        json={
            "assessment": "Sinh viên cần rà soát kế hoạch học lại.",
            "conclusion": "support_needed",
            "action_plan": "Trao đổi trực tiếp và theo dõi GPA học kỳ tới.",
            "confirm": True,
        },
    )
    appointment = await client.post(
        f"/api/v1/interventions/cases/{case_id}/appointments",
        json={
            "scheduled_at": "2026-07-05T09:00:00+07:00",
            "meeting_mode": "in_person",
            "location": "Phòng cố vấn",
            "purpose": "Thống nhất kế hoạch học lại",
        },
    )
    appointment_id = appointment.json()["id"]
    completed = await client.patch(
        f"/api/v1/interventions/appointments/{appointment_id}",
        json={"status": "completed", "result": "Sinh viên đã thống nhất kế hoạch."},
    )
    detail = await client.get(f"/api/v1/interventions/cases/{case_id}")
    history = await client.get(f"/api/v1/interventions/students/{student.id}/history")

    assert assessment.status_code == 200
    assert assessment.json()["assessment_confirmed_by_user_id"] == lecturer.id
    assert assessment.json()["assessment_confirmed_at"] is not None
    assert appointment.status_code == 201
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completed_at"] is not None
    assert {item["subject"] for item in history.json()} >= {
        "Nhận định hỗ trợ học tập đã xác nhận",
        "Lịch trao đổi hỗ trợ học tập",
    }
    assert {event["event_type"] for event in detail.json()["events"]} >= {
        "assessment_confirmed",
        "appointment_scheduled",
        "appointment_completed",
    }


async def test_bulk_notice_is_saved_to_each_student_history(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    student = data["own_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    created = await client.post(
        "/api/v1/interventions/cases",
        json={"student_id": student.id, "scope_type": "homeroom", "class_code": "K21-A"},
    )

    notice = await client.post(
        "/api/v1/interventions/bulk-notice",
        json={
            "case_ids": [created.json()["id"]],
            "title": "Nhận xét tình trạng học tập",
            "message": "Cần rà soát kế hoạch học lại và phản hồi cố vấn.",
        },
    )
    history = await client.get(f"/api/v1/interventions/students/{student.id}/history")
    detail = await client.get(f"/api/v1/interventions/cases/{created.json()['id']}")

    assert notice.status_code == 201
    assert notice.json()["created_count"] == 1
    assert history.status_code == 200
    assert history.json()[0]["student_id"] == student.id
    assert history.json()[0]["subject"] == "Nhận xét tình trạng học tập"
    assert history.json()[0]["message"] == "Cần rà soát kế hoạch học lại và phản hồi cố vấn."
    assert history.json()[0]["metadata_json"]["source"] == "advisor_bulk_notice_v1"
    assert {event["event_type"] for event in detail.json()["events"]} >= {"bulk_notice_logged"}


async def test_internal_campaign_is_reviewed_before_student_history_is_created(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    student = data["own_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    case = await client.post(
        "/api/v1/interventions/cases",
        json={"student_id": student.id, "scope_type": "homeroom", "class_code": "K21-A"},
    )

    campaign = await client.post(
        "/api/v1/interventions/campaigns",
        json={
            "scope_type": "homeroom",
            "class_code": "K21-A",
            "title": "Trao đổi hỗ trợ học tập",
            "student_ids": [student.id],
        },
    )
    assert campaign.status_code == 201
    campaign_id = campaign.json()["id"]

    drafted = await client.post(
        f"/api/v1/interventions/campaigns/{campaign_id}/generate-drafts",
        json={
            "student_ids": [student.id],
            "channel": "internal",
            "subject": "Trao đổi riêng",
            "message_template": "Chào {full_name}, em vui lòng phản hồi thầy/cô.",
        },
    )
    assert drafted.status_code == 200
    message = drafted.json()["messages"][0]
    assert student.full_name in message["body"]
    assert (await client.get(f"/api/v1/interventions/students/{student.id}/history")).json() == []

    edited = await client.patch(
        f"/api/v1/interventions/campaigns/messages/{message['id']}",
        json={"body": "Nội dung đã được giảng viên chỉnh riêng."},
    )
    assert edited.status_code == 200
    assert edited.json()["body"] == "Nội dung đã được giảng viên chỉnh riêng."

    assert (await client.post(f"/api/v1/interventions/campaigns/{campaign_id}/approve")).status_code == 200
    sent = await client.post(f"/api/v1/interventions/campaigns/{campaign_id}/send")
    history = await client.get(f"/api/v1/interventions/students/{student.id}/history")
    closed_case = await client.get(f"/api/v1/interventions/cases/{case.json()['id']}")

    assert sent.status_code == 200
    assert sent.json()["status"] == "completed"
    assert sent.json()["sent_count"] == 1
    assert history.json()[0]["message"] == "Nội dung đã được giảng viên chỉnh riêng."
    assert history.json()[0]["metadata_json"]["delivery_mode"] == "internal"
    assert closed_case.json()["status"] == "resolved"
    assert closed_case.json()["resolved_at"] is not None


async def test_manager_can_prepare_edit_and_approve_scoped_campaign(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    manager = data["manager"]
    lecturer = data["lecturer"]
    student = data["own_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    created = await client.post(
        "/api/v1/interventions/campaigns",
        json={
            "scope_type": "homeroom",
            "class_code": "K21-A",
            "title": "Đợt hỗ trợ do quản lý chuẩn bị",
            "student_ids": [student.id],
        },
    )
    assert created.status_code == 201
    assert created.json()["actor_user_id"] == lecturer.id
    assert created.json()["summary_json"]["prepared_by_user_id"] == manager.id
    manager_notifications = await client.get("/api/v1/notifications")
    assert manager_notifications.json()[0]["notification_type"] == "intervention_campaign_created"

    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    lecturer_notifications = await client.get("/api/v1/notifications")
    assert lecturer_notifications.json()[0]["notification_type"] == "intervention_campaign_review_required"
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    campaign_id = created.json()["id"]
    drafted = await client.post(
        f"/api/v1/interventions/campaigns/{campaign_id}/generate-drafts",
        json={
            "student_ids": [student.id],
            "channel": "internal",
            "subject": "Trao đổi học tập",
            "message_template": "Chào {full_name}",
        },
    )
    edited = await client.patch(
        f"/api/v1/interventions/campaigns/messages/{drafted.json()['messages'][0]['id']}",
        json={"body": "Quản lý đã rà soát nội dung."},
    )
    approved = await client.post(f"/api/v1/interventions/campaigns/{campaign_id}/approve")

    assert drafted.status_code == 200
    assert edited.status_code == 200
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"


async def test_scoped_viewer_cannot_mutate_intervention_campaign(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    manager = data["manager"]
    student = data["own_student"]
    viewer = User(
        id="homeroom-viewer",
        email="homeroom.viewer@example.com",
        hashed_password=hash_password("password123"),
        full_name="Homeroom Viewer",
        role=UserRole.viewer,
        department_id=manager.department_id,
    )
    db_session.add(viewer)
    await db_session.flush()

    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"
    created = await client.post(
        "/api/v1/interventions/campaigns",
        json={
            "scope_type": "homeroom",
            "class_code": "K21-A",
            "title": "Đợt hỗ trợ cần bảo vệ quyền ghi",
            "student_ids": [student.id],
        },
    )
    campaign_id = created.json()["id"]
    drafted = await client.post(
        f"/api/v1/interventions/campaigns/{campaign_id}/generate-drafts",
        json={
            "student_ids": [student.id],
            "channel": "internal",
            "subject": "Trao đổi học tập",
            "message_template": "Chào {full_name}",
        },
    )
    message_id = drafted.json()["messages"][0]["id"]

    client.headers["Authorization"] = f"Bearer {create_access_token(viewer.id, viewer.role)}"
    create_attempt = await client.post(
        "/api/v1/interventions/campaigns",
        json={
            "scope_type": "homeroom",
            "class_code": "K21-A",
            "title": "Viewer không được tạo",
            "student_ids": [student.id],
        },
    )
    generate_attempt = await client.post(
        f"/api/v1/interventions/campaigns/{campaign_id}/generate-drafts",
        json={"student_ids": [student.id], "channel": "internal", "subject": "Không hợp lệ"},
    )
    edit_attempt = await client.patch(
        f"/api/v1/interventions/campaigns/messages/{message_id}",
        json={"body": "Viewer không được sửa."},
    )
    approve_attempt = await client.post(f"/api/v1/interventions/campaigns/{campaign_id}/approve")
    send_attempt = await client.post(f"/api/v1/interventions/campaigns/{campaign_id}/send")

    assert create_attempt.status_code == 403
    assert generate_attempt.status_code == 403
    assert edit_attempt.status_code == 403
    assert approve_attempt.status_code == 403
    assert send_attempt.status_code == 403


async def test_manager_can_view_but_not_edit_advisor_assessment(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    data = await _seed_homeroom_data(db_session)
    lecturer = data["lecturer"]
    manager = data["manager"]
    student = data["own_student"]
    client.headers["Authorization"] = f"Bearer {create_access_token(lecturer.id, lecturer.role)}"
    created = await client.post(
        "/api/v1/interventions/cases",
        json={"student_id": student.id, "scope_type": "homeroom", "class_code": "K21-A"},
    )

    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"
    response = await client.put(
        f"/api/v1/interventions/cases/{created.json()['id']}/assessment",
        json={"assessment": "Manager must not author this.", "conclusion": "monitor", "confirm": True},
    )

    assert response.status_code == 403
