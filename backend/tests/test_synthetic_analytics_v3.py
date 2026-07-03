import pytest

from scripts.generate_synthetic_analytics_v3 import DEFAULT_SEED, generate
from scripts.import_synthetic_analytics_v3 import require_safe_environment


def _catalog() -> dict:
    return {"programs": [{
        "program_id": 7, "program_code": "CNTT", "active_students_with_enrollments": 28,
        "course_ids": [1, 2, 3, 4, 5], "semester_ids": [10, 11, 12, 13],
        "cohort_ids": [2], "teacher_ids": [3, 4],
    }]}


def test_generator_is_deterministic_except_timestamp() -> None:
    first = generate(_catalog(), DEFAULT_SEED)
    second = generate(_catalog(), DEFAULT_SEED)
    first.pop("generated_at")
    second.pop("generated_at")
    assert first == second


def test_generator_fills_sparse_program_to_target_with_lineage() -> None:
    artifact = generate(_catalog())
    program = artifact["programs"][0]
    assert artifact["source"] == "synthetic_analytics_v3"
    assert artifact["official"] is False
    assert program["baseline"] + len(program["students"]) == 30
    assert len(program["students"][0]["enrollments"]) == 20
    assert all(section["teacher_id"] for section in program["sections"])


def test_import_is_blocked_in_production() -> None:
    with pytest.raises(RuntimeError):
        require_safe_environment("production")
    require_safe_environment("staging")
