"""Behavioral coverage for H49 chatbot data-access scope."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.agent.tools import (
    execute_sql_query,
    get_student_dropout_risk,
    lookup_student_by_code,
    reset_agent_tool_context,
    set_agent_tool_context,
)


@patch("app.agent.tools.psycopg2.connect")
def test_h49_sql_tool_blocks_direct_oltp_tables(mock_connect: MagicMock) -> None:
    result = execute_sql_query.invoke({"query": "SELECT id, full_name FROM students LIMIT 5"})

    assert result.startswith("ERROR:")
    assert "H49" in result
    mock_connect.assert_not_called()


@patch("app.agent.tools.psycopg2.connect")
def test_h49_student_lookup_refuses_cross_scope(mock_connect: MagicMock) -> None:
    cursor = MagicMock()
    cursor.fetchone.return_value = (
        110,
        "21810310019",
        "DINH TAN HOANG",
        "active",
        10,
        2,
        3.2,
        99,
    )
    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = connection

    token = set_agent_tool_context({"user_role": "manager", "department_scope": 1})
    try:
        result = lookup_student_by_code.invoke({"student_code": "21810310019"})
    finally:
        reset_agent_tool_context(token)

    assert result.startswith("ERROR:")
    assert "không có quyền" in result.lower()
    assert "21810310019" not in result


@patch("app.agent.tools.psycopg2.connect")
def test_h49_dropout_tool_refuses_cross_scope_prediction(mock_connect: MagicMock) -> None:
    cursor = MagicMock()
    cursor.fetchone.return_value = (
        "Nguyen Van A",
        "21000000001",
        0.55,
        "medium",
        [{"feature": "fail_rate", "impact": 0.3}],
        None,
        "dropout_classifier",
        "v1",
        99,
    )
    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = connection

    token = set_agent_tool_context({"user_role": "lecturer", "department_scope": 1})
    try:
        result = get_student_dropout_risk.invoke({"student_code": "21000000001"})
    finally:
        reset_agent_tool_context(token)

    assert result.startswith("ERROR:")
    assert "không có quyền" in result.lower()
    assert "dropout_probability" not in result
