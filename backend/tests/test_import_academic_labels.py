"""T52a — student status and is_active mapping for dropout labels."""

import pytest

from scripts.import_academic_dataset import is_student_active, normalize_dataset
from tests.test_import_academic_dataset import _mapping, _source_row


@pytest.mark.parametrize(
    ("status_vn", "expected_status", "expected_active"),
    [
        ("Đang học", "active", True),
        ("Tốt nghiệp", "graduated", False),
        ("Buộc thôi học", "expelled", False),
        ("Thôi học", "withdrawn", False),
    ],
)
def test_status_and_is_active_mapping(status_vn: str, expected_status: str, expected_active: bool) -> None:
    row = _source_row()
    row["student_info"]["Trạng thái"] = status_vn
    artifact = normalize_dataset(
        [row],
        [_mapping()],
        {"Kiểm thử phần mềm": "Khoa Test"},
    )
    student = artifact["students"][0]
    assert student["status"] == expected_status
    assert is_student_active(student["status"]) is expected_active


def test_dropout_label_counts_in_artifact() -> None:
    """H46 artifact should contain ~120 expelled/withdrawn students when loaded."""
    from pathlib import Path

    from scripts.import_academic_dataset import load_artifact

    artifact_path = Path(__file__).resolve().parents[1] / "db" / "seed-academic-v2.json.gz"
    if not artifact_path.exists():
        pytest.skip("seed artifact not present in workspace")

    artifact = load_artifact(artifact_path)
    statuses = {student["status"] for student in artifact["students"]}
    expelled = sum(1 for student in artifact["students"] if student["status"] == "expelled")
    withdrawn = sum(1 for student in artifact["students"] if student["status"] == "withdrawn")

    assert "expelled" in statuses
    assert "withdrawn" in statuses
    assert expelled + withdrawn >= 100
    assert artifact["manifest"]["unique_students"] == 1277
