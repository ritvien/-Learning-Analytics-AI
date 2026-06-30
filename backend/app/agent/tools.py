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
from contextvars import ContextVar, Token
from typing import Any

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

_TOOL_CONTEXT: ContextVar[dict[str, Any] | None] = ContextVar(
    "eduinsight_agent_tool_context",
    default=None,
)
_UNRESTRICTED_ROLES = {"superadmin", "admin"}
_ALLOWED_ANALYTICS_RELATIONS = {
    "vw_course_stats",
    "vw_program_stats",
    "vw_department_stats",
    "vw_section_stats",
}
_RELATION_PATTERN = re.compile(
    r"\b(?:FROM|JOIN)\s+([A-Za-z_][\w.]*|\"[^\"]+\"(?:\.\"[^\"]+\")?)",
    re.IGNORECASE,
)
_CTE_PATTERN = re.compile(r"(?:WITH|,)\s+([A-Za-z_][\w]*)\s+AS\s*\(", re.IGNORECASE)


def set_agent_tool_context(context: dict[str, Any] | None) -> Token[dict[str, Any] | None]:
    """Set server-authoritative context for subsequent agent tool calls."""
    return _TOOL_CONTEXT.set(dict(context or {}))


def reset_agent_tool_context(token: Token[dict[str, Any] | None]) -> None:
    """Reset tool context, primarily for tests that set it explicitly."""
    _TOOL_CONTEXT.reset(token)


def get_agent_tool_context() -> dict[str, Any]:
    """Return the current agent tool context."""
    return dict(_TOOL_CONTEXT.get() or {})


def _normalize_relation_name(raw: str) -> str:
    return raw.replace('"', "").strip().lower()


def _cte_names(query: str) -> set[str]:
    return {match.group(1).lower() for match in _CTE_PATTERN.finditer(query)}


def _extract_relation_names(query: str) -> list[str]:
    ctes = _cte_names(query)
    relations: list[str] = []
    for match in _RELATION_PATTERN.finditer(query):
        relation = _normalize_relation_name(match.group(1))
        if relation in ctes:
            continue
        relations.append(relation)
    return relations


def _is_allowed_analytics_relation(relation: str) -> bool:
    return relation.startswith("dwh.") or relation in _ALLOWED_ANALYTICS_RELATIONS


def _is_scope_allowed(student_department_id: int | None) -> bool:
    context = get_agent_tool_context()
    role = str(context.get("user_role") or "").strip().lower()
    department_scope = context.get("department_scope") or context.get("department_id")
    if not context or role in _UNRESTRICTED_ROLES or department_scope in (None, ""):
        return True
    if student_department_id is None:
        return True
    try:
        return int(department_scope) == int(student_department_id)
    except (TypeError, ValueError):
        return False


def _scope_refusal() -> str:
    return "ERROR: Tôi không có quyền truy cập dữ liệu ngoài phạm vi vai trò hiện tại."


def _sanitize_query(query: str) -> str:
    """Validate that a SQL query is read-only SELECT.

    Raises:
        ValueError: if the query contains forbidden DDL/DML keywords.

    """
    query = query.strip().rstrip(";")
    if ";" in query:
        raise ValueError("Chỉ được phép chạy một câu SELECT tại một thời điểm.")
    if not re.match(r"^\s*(SELECT|WITH)\b", query, flags=re.IGNORECASE):
        raise ValueError("Chỉ được phép dùng SELECT read-only.")
    if _FORBIDDEN_KEYWORDS.search(query):
        raise ValueError(
            "Chỉ được phép dùng SELECT. Câu lệnh chứa từ khóa bị cấm."
        )
    blocked = [
        relation
        for relation in _extract_relation_names(query)
        if not _is_allowed_analytics_relation(relation)
    ]
    if blocked:
        raise ValueError(
            "Nguồn dữ liệu không nằm trong phạm vi H49. "
            "Analytics chỉ được đọc từ schema dwh hoặc các view thống kê đã whitelist; "
            "tra MSSV/CLO/dropout phải dùng tool chuyên biệt."
        )
    return query


@tool
def execute_sql_query(query: str) -> str:
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


sql_query_tool = execute_sql_query


@tool
def calculate_student_clo_scores(student_code: str, course_name: str) -> str:
    """Tính toán điểm số Chuẩn đầu ra (CLO) của một sinh viên cụ thể trong một môn học cụ thể.

    Dùng tool này KHI NGƯỜI DÙNG HỎI: "Sinh viên X đạt bao nhiêu điểm CLO môn Y?", 
    "Hãy phân tích mức độ đạt chuẩn đầu ra môn Z của sinh viên W".

    Args:
        student_code: Mã sinh viên (ví dụ: "19810310243", "SV001").
        course_name: Tên môn học (ví dụ: "Tiếng Anh 1", "Toán cao cấp"). Hỗ trợ tìm kiếm gần đúng.

    Returns:
        JSON string chứa điểm số của từng CLO, hoặc câu thông báo lỗi.
    """
    settings = get_settings()
    conn = None
    try:
        conn = psycopg2.connect(settings.agent_db_url)
        conn.set_session(readonly=True, autocommit=True)

        with conn.cursor() as cur:
            # 1. Find enrollment and course
            query_enrollment = """
                SELECT e.id, c.name, s.full_name, p.department_id
                FROM enrollments e
                JOIN students s ON e.student_id = s.id
                LEFT JOIN programs p ON p.id = s.program_id
                JOIN sections sec ON e.section_id = sec.id
                JOIN courses c ON sec.course_id = c.id
                WHERE s.student_code = %s AND c.name ILIKE %s
                LIMIT 1
            """
            cur.execute(query_enrollment, (student_code, f"%{course_name}%"))
            enroll_row = cur.fetchone()
            
            if not enroll_row:
                return f"ERROR: Không tìm thấy dữ liệu học tập của sinh viên '{student_code}' cho môn '{course_name}'."
                
            enrollment_id, found_course, student_name = enroll_row[:3]
            student_department_id = enroll_row[3] if len(enroll_row) > 3 else None
            if not _is_scope_allowed(student_department_id):
                return _scope_refusal()

            # 2. Calculate CLO scores
            query_clo = """
                SELECT 
                    cl.code as clo_code,
                    cl.description as clo_desc,
                    SUM(gc.score * gccm.weight * gct.weight) / NULLIF(SUM(gccm.weight * gct.weight), 0) as clo_score
                FROM grade_components gc
                JOIN grade_component_types gct ON gc.component_type_id = gct.id
                JOIN grade_component_clo_mappings gccm ON gct.id = gccm.component_type_id
                JOIN clos cl ON gccm.clo_id = cl.id
                WHERE gc.enrollment_id = %s
                GROUP BY cl.id, cl.code, cl.description
                ORDER BY cl.sort_order
            """
            cur.execute(query_clo, (enrollment_id,))
            rows = cur.fetchall()
            
            if not rows:
                return f"LƯU Ý: Môn học '{found_course}' hiện chưa có dữ liệu điểm thành phần hoặc chưa có chuẩn đầu ra (CLO) để tính toán."
                
            results = {
                "student_name": student_name,
                "student_code": student_code,
                "course_name": found_course,
                "clos": []
            }
            
            for r in rows:
                score = round(float(r[2]), 2) if r[2] is not None else 0.0
                results["clos"].append({
                    "clo_code": r[0],
                    "description": r[1],
                    "score": score,
                    "status": "ĐẠT" if score >= 4.0 else "KHÔNG ĐẠT"
                })

            return json.dumps(results, ensure_ascii=False, indent=2)

    except psycopg2.Error as exc:
        logger.warning("clo_calculator_tool DB error: %s", exc)
        return f"ERROR: Lỗi CSDL khi tính toán CLO — {exc}"
    except Exception as exc:
        logger.exception("clo_calculator_tool unexpected error")
        return f"ERROR: Lỗi không xác định — {exc}"
    finally:
        if conn is not None:
            conn.close()


@tool
def lookup_student_by_code(student_code: str) -> str:
    """Tra cứu sinh viên theo mã MSSV (student_code) và trả về student_id nội bộ.

    Dùng tool này khi người dùng cung cấp mã sinh viên (ví dụ "21810310019") và bạn cần
    student_id để gọi API hoặc truy vấn khác dùng khóa số. Cũng dùng để xác nhận SV tồn tại
    trước khi phân tích dropout hoặc điểm số.

    Args:
        student_code: Mã sinh viên / MSSV (ví dụ: "21810310019", "21000000001").

    Returns:
        JSON string chứa student_id, student_code, full_name, status, program_id, cohort_id;
        hoặc thông báo lỗi nếu không tìm thấy.

    """
    settings = get_settings()
    conn = None
    try:
        conn = psycopg2.connect(settings.agent_db_url)
        conn.set_session(readonly=True, autocommit=True)

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT s.id, s.student_code, s.full_name, s.status, s.program_id,
                       s.cohort_id, s.gpa_cumulative, p.department_id
                FROM students s
                LEFT JOIN programs p ON p.id = s.program_id
                WHERE s.student_code = %s
                LIMIT 1
                """,
                (student_code.strip(),),
            )
            row = cur.fetchone()
            if row is None:
                return f"ERROR: Không tìm thấy sinh viên với mã '{student_code}'."

            student_department_id = row[7] if len(row) > 7 else None
            if not _is_scope_allowed(student_department_id):
                return _scope_refusal()

            payload = {
                "student_id": row[0],
                "student_code": row[1],
                "full_name": row[2],
                "status": row[3],
                "program_id": row[4],
                "cohort_id": row[5],
                "gpa_cumulative": float(row[6]) if row[6] is not None else None,
            }
            return json.dumps(payload, ensure_ascii=False, indent=2)
    except psycopg2.Error as exc:
        logger.warning("lookup_student_tool DB error: %s", exc)
        return f"ERROR: Lỗi CSDL khi tra cứu sinh viên — {exc}"
    except Exception as exc:
        logger.exception("lookup_student_tool unexpected error")
        return f"ERROR: Lỗi không xác định — {exc}"
    finally:
        if conn is not None:
            conn.close()


@tool
def get_student_dropout_risk(student_code: str) -> str:
    """Lấy xác suất dropout đã được mô hình ML tính sẵn từ schema ml.

    Dùng tool này khi người dùng hỏi về nguy cơ bỏ học / dropout của một sinh viên.
    KHÔNG tự ước lượng hoặc bịa xác suất — chỉ đọc prediction đã lưu trong ml.student_dropout_prediction.

    Args:
        student_code: Mã sinh viên (ví dụ: "21000000001").

    Returns:
        JSON string chứa dropout_probability, risk_level, model_version và top_factors,
        hoặc thông báo lỗi nếu chưa có prediction.

    """
    settings = get_settings()
    conn = None
    try:
        conn = psycopg2.connect(settings.agent_db_url)
        conn.set_session(readonly=True, autocommit=True)

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    s.full_name,
                    s.student_code,
                    p.dropout_probability,
                    p.risk_level,
                    p.top_factors,
                    p.scored_at,
                    r.model_name,
                    r.model_version,
                    prog.department_id
                FROM ml.student_dropout_prediction p
                JOIN ml.model_run r ON r.id = p.model_run_id
                JOIN students s ON s.id = p.student_id
                LEFT JOIN programs prog ON prog.id = s.program_id
                WHERE s.student_code = %s AND r.status = 'completed'
                ORDER BY p.scored_at DESC
                LIMIT 1
                """,
                (student_code,),
            )
            row = cur.fetchone()
            if row is None:
                return (
                    f"ERROR: Chưa có dự đoán dropout ML cho sinh viên '{student_code}'. "
                    "Cần chạy train/score trước."
                )

            student_department_id = row[8] if len(row) > 8 else None
            if not _is_scope_allowed(student_department_id):
                return _scope_refusal()

            payload = {
                "student_name": row[0],
                "student_code": row[1],
                "dropout_probability": float(row[2]),
                "risk_level": row[3],
                "top_factors": row[4],
                "scored_at": row[5].isoformat() if row[5] else None,
                "model_name": row[6],
                "model_version": row[7],
            }
            return json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    except psycopg2.Error as exc:
        logger.warning("dropout_risk_tool DB error: %s", exc)
        return f"ERROR: Lỗi CSDL khi đọc prediction dropout — {exc}"
    except Exception as exc:
        logger.exception("dropout_risk_tool unexpected error")
        return f"ERROR: Lỗi không xác định — {exc}"
    finally:
        if conn is not None:
            conn.close()
