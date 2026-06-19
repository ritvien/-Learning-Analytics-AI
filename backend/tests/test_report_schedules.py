"""Integration tests for recurring report schedules."""

from httpx import AsyncClient


async def test_create_list_and_run_report_schedule(client: AsyncClient) -> None:
    create_response = await client.post(
        "/api/v1/reports/schedules",
        json={
            "name": "Weekly school health",
            "report_type": "school_overview",
            "actor_role": "manager",
            "scope_type": "school",
            "scope_id": None,
            "frequency": "weekly",
            "trigger_event": "scheduled_monday",
            "recipients_json": ["manager"],
            "formats_json": ["web", "pdf"],
            "detail_level": "standard",
            "include_ai_narrative": True,
            "include_appendix": True,
        },
    )

    assert create_response.status_code == 201
    schedule = create_response.json()
    assert schedule["id"]
    assert schedule["next_run_at"]

    list_response = await client.get("/api/v1/reports/schedules")
    assert list_response.status_code == 200
    assert any(item["id"] == schedule["id"] for item in list_response.json())

    run_response = await client.post(
        f"/api/v1/reports/schedules/{schedule['id']}/run",
        json={"trigger": "manual"},
    )
    assert run_response.status_code == 201
    run = run_response.json()
    assert run["status"] == "success"
    assert run["report_id"]

    runs_response = await client.get(f"/api/v1/reports/schedules/{schedule['id']}/runs")
    assert runs_response.status_code == 200
    assert runs_response.json()[0]["report_id"] == run["report_id"]
