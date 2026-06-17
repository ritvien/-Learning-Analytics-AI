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
                SELECT e.id, c.name, s.full_name
                FROM enrollments e
                JOIN students s ON e.student_id = s.id
                JOIN sections sec ON e.section_id = sec.id
                JOIN courses c ON sec.course_id = c.id
                WHERE s.student_code = %s AND c.name ILIKE %s
                LIMIT 1
            """
            cur.execute(query_enrollment, (student_code, f"%{course_name}%"))
            enroll_row = cur.fetchone()
            
            if not enroll_row:
                return f"ERROR: Không tìm thấy dữ liệu học tập của sinh viên '{student_code}' cho môn '{course_name}'."
                
            enrollment_id, found_course, student_name = enroll_row

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
