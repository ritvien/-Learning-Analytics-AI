"""Unit tests for agent tools."""

import json
from unittest.mock import MagicMock, patch

import psycopg2
import pytest

from app.agent.tools import (
    _sanitize_query,
    calculate_student_clo_scores,
    execute_sql_query,
)


def test_sanitize_query_allows_select():
    """Valid SELECT queries pass sanitization."""
    query = "SELECT * FROM students WHERE id = 1"
    assert _sanitize_query(query) == query


@pytest.mark.parametrize(
    "forbidden_word",
    ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE", "EXEC", "EXECUTE"]
)
def test_sanitize_query_blocks_forbidden(forbidden_word):
    """Forbidden keywords raise ValueError."""
    query = f"{forbidden_word} INTO students VALUES (1)"
    with pytest.raises(ValueError, match="Chỉ được phép dùng SELECT"):
        _sanitize_query(query)


def test_sanitize_query_strips_semicolons():
    """Trailing semicolons are stripped."""
    query = "SELECT * FROM students;"
    assert _sanitize_query(query) == "SELECT * FROM students"


def test_sanitize_query_case_insensitive():
    """Case is ignored when blocking forbidden keywords."""
    query = "dRoP TABLE students"
    with pytest.raises(ValueError, match="Chỉ được phép dùng SELECT"):
        _sanitize_query(query)


def test_execute_sql_query_returns_error_on_forbidden():
    """Tool execution returns ERROR string instead of crashing when query is forbidden."""
    result = execute_sql_query.invoke({"query": "DROP TABLE students"})
    assert isinstance(result, str)
    assert result.startswith("ERROR: Chỉ được phép dùng SELECT")


@patch("app.agent.tools.psycopg2.connect")
def test_execute_sql_query_db_connection_error(mock_connect):
    """Database connection errors are gracefully caught."""
    mock_connect.side_effect = psycopg2.OperationalError("connection failed")
    
    result = execute_sql_query.invoke({"query": "SELECT 1"})
    assert "ERROR: Lỗi SQL" in result


@patch("app.agent.tools.psycopg2.connect")
def test_execute_sql_query_success(mock_connect):
    """Successful SELECT returns JSON string."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_connect.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    
    mock_cursor.description = [("id",), ("name",)]
    mock_cursor.fetchmany.return_value = [(1, "Alice"), (2, "Bob")]
    
    result = execute_sql_query.invoke({"query": "SELECT id, name FROM students"})
    
    assert isinstance(result, str)
    parsed = json.loads(result)
    assert len(parsed) == 2
    assert parsed[0]["name"] == "Alice"


@patch("app.agent.tools.psycopg2.connect")
def test_calculate_student_clo_scores_not_found(mock_connect):
    """Returns ERROR string when student or course is not found."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_connect.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
    
    # fetchone returns None -> no enrollment found
    mock_cursor.fetchone.return_value = None
    
    result = calculate_student_clo_scores.invoke({"student_code": "SV999", "course_name": "Unknown"})
    assert "ERROR: Không tìm thấy dữ liệu học tập" in result
