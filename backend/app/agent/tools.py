"""LangGraph tools for the EduInsight Agent.

Design principles:
- Single Responsibility: one tool = one action (execute SQL query).
- Idempotent: same query always returns the same result (read-only).
- Granularity: one focused tool rather than a multi-purpose "do anything" tool.
- Independently testable: can be called outside the agent for verification.
"""

import json
import logging
import re

import psycopg2
from langchain_core.tools import tool

from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Safety: only allow SELECT statements
# ---------------------------------------------------------------------------
_FORBIDDEN_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE)\b",
    re.IGNORECASE,
)

MAX_ROWS = 50  # prevent token explosion in LLM context


def _sanitize_query(query: str) -> str:
    """Validate that a SQL query is read-only SELECT.

    Raises:
        ValueError: if the query contains forbidden DDL/DML keywords.

    """
    query = query.strip().rstrip(";")
    if _FORBIDDEN_KEYWORDS.search(query):
        raise ValueError(
            "Chỉ được phép dùng SELECT. Câu lệnh chứa từ khóa bị cấm."
        )
    return query


@tool
def sql_query_tool(query: str) -> str:
    """Thực thi câu lệnh SQL SELECT trên database học vụ EduInsight (PostgreSQL).

    Dùng tool này khi cần tra cứu điểm số, tỷ lệ trượt, thống kê sinh viên,
    CLO/PLO, hoặc bất kỳ dữ liệu nào trong database học vụ.

    Args:
        query: Câu lệnh PostgreSQL SELECT hợp lệ. Không được chứa
               INSERT/UPDATE/DELETE/DROP. Kết quả giới hạn tối đa 50 dòng.

    Returns:
        JSON string — danh sách dicts nếu thành công,
        hoặc chuỗi bắt đầu bằng "ERROR:" nếu thất bại.

    """
    settings = get_settings()

    # --- Step 1: Validate query safety
    try:
        sanitized = _sanitize_query(query)
    except ValueError as exc:
        return f"ERROR: {exc}"

    # --- Step 2: Execute against PostgreSQL
    conn = None
    try:
        conn = psycopg2.connect(settings.agent_db_url)
        conn.set_session(readonly=True, autocommit=True)

        with conn.cursor() as cur:
            cur.execute(sanitized)
            columns = [desc[0] for desc in cur.description] if cur.description else []
            rows = cur.fetchmany(MAX_ROWS)

        result = [dict(zip(columns, row, strict=True)) for row in rows]

        # --- Step 3: Serialize (handle Decimal, date, etc.)
        return json.dumps(result, ensure_ascii=False, default=str)

    except psycopg2.Error as exc:
        logger.warning("sql_query_tool DB error: %s | query: %s", exc, sanitized)
        return f"ERROR: Lỗi SQL — {exc.pgerror or exc}"
    except Exception as exc:
        logger.exception("sql_query_tool unexpected error")
        return f"ERROR: Lỗi không xác định — {exc}"
    finally:
        if conn is not None:
            conn.close()
