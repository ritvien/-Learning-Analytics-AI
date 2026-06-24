"""Tests for dropout agent tool."""

from unittest.mock import MagicMock, patch

from app.agent.tools import get_student_dropout_risk


@patch("app.agent.tools.psycopg2.connect")
def test_dropout_tool_returns_ml_prediction(mock_connect: MagicMock) -> None:
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
    )
    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = connection

    result = get_student_dropout_risk.invoke({"student_code": "21000000001"})

    assert "dropout_probability" in result
    assert "0.55" in result
    assert "dropout_classifier" in result


@patch("app.agent.tools.psycopg2.connect")
def test_dropout_tool_does_not_invent_probability_when_missing(mock_connect: MagicMock) -> None:
    cursor = MagicMock()
    cursor.fetchone.return_value = None
    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = connection

    result = get_student_dropout_risk.invoke({"student_code": "missing"})

    assert result.startswith("ERROR:")
    assert "Chưa có dự đoán dropout ML" in result
