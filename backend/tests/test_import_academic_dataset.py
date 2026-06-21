"""H46 source normalization and artifact integrity tests."""

from copy import deepcopy

import pytest

from scripts.import_academic_dataset import (
    DatasetValidationError,
    canonical_key,
    course_key,
    load_artifact,
    normalize_dataset,
    stable_code,
    write_artifact,
)


def _mapping(class_code: str = "D21TEST", department: str = "Khoa Test") -> dict:
    return {
        "class_code": class_code,
        "khoa": department,
        "nganh": "Công nghệ thông tin",
        "chuyen_nganh": "Công nghệ phần mềm",
    }


def _source_row(
    *,
    student_code: str = "21000000001",
    class_code: str = "D21TEST",
    full_name: str = "Nguyễn Văn A",
    course_name: str = "Kiểm thử phần mềm",
    final_grade: str = "8.00",
) -> dict:
    return {
        "token": "not-persisted",
        "student_info": {
            "Họ và tên": full_name,
            "MSSV": student_code,
            "Trạng thái": "Đang học",
            "Giới tính": "Nam",
            "Khóa": "2021",
            "Ngành": "Công nghệ thông tin",
            "Chuyên ngành": "Công nghệ phần mềm",
            "Khoa": "Khoa Test",
            "Lớp": class_code,
        },
        "grades": [
            {
                "Học kỳ": "HK1 (2021-2022)",
                "STT": "1",
                "Tên môn học": course_name,
                "Mã lớp": "010100000001",
                "TC": "3",
                "TX1": "9.00",
                "Điểm tổng kết": final_grade,
                "Xếp loại": "[B+ - ]",
            }
        ],
    }


def test_normalize_deduplicates_students_and_prefers_complete_grade() -> None:
    incomplete = _source_row(final_grade="")
    complete = _source_row()
    artifact = normalize_dataset(
        [incomplete, complete, {"token": "failed", "student_info": {}, "grades": []}],
        [_mapping()],
        {"Kiểm thử phần mềm": "Khoa Test"},
    )

    assert artifact["manifest"]["unique_students"] == 1
    assert artifact["manifest"]["duplicate_student_rows"] == 1
    assert artifact["manifest"]["failed_source_rows"] == 1
    assert artifact["manifest"]["enrollments"] == 1
    assert artifact["manifest"]["grade_conflicts"] == 0
    assert artifact["grades"][0]["final_grade"] == 8.0
    assert artifact["students"][0]["specialization_code"] == stable_code(
        "SPEC", "Công nghệ thông tin", "Công nghệ phần mềm"
    )


def test_normalize_rejects_duplicate_identity_conflict() -> None:
    conflicting = _source_row(full_name="Trần Văn B")
    with pytest.raises(DatasetValidationError, match="Identity conflict"):
        normalize_dataset(
            [_source_row(), conflicting],
            [_mapping()],
            {"Kiểm thử phần mềm": "Khoa Test"},
        )


def test_normalize_rejects_ambiguous_unreviewed_course_department() -> None:
    second = _source_row(student_code="21000000002", class_code="D21OTHER")
    with pytest.raises(DatasetValidationError, match="Ambiguous department"):
        normalize_dataset(
            [_source_row(), second],
            [_mapping(), _mapping("D21OTHER", "Khoa Khác")],
            {},
        )


def test_artifact_checksum_detects_tampering(tmp_path) -> None:
    artifact = normalize_dataset(
        [_source_row()],
        [_mapping()],
        {"Kiểm thử phần mềm": "Khoa Test"},
    )
    artifact_path = tmp_path / "academic.json.gz"
    manifest_path = tmp_path / "manifest.json"
    catalog_path = tmp_path / "catalog.json"
    write_artifact(artifact, artifact_path, manifest_path, catalog_path)

    loaded = load_artifact(artifact_path)
    assert loaded["manifest"]["artifact_checksum"] == artifact["manifest"]["artifact_checksum"]
    assert catalog_path.exists()

    tampered = deepcopy(artifact)
    tampered["students"][0]["full_name"] = "Tampered"
    write_artifact(tampered, artifact_path, manifest_path, catalog_path)
    with pytest.raises(DatasetValidationError, match="checksum mismatch"):
        load_artifact(artifact_path)


def test_canonical_key_handles_dashes_accents_and_unicode_forms() -> None:
    assert canonical_key("Tài chính – Ngân hàng") == canonical_key("Tai chinh - Ngan hang")  # noqa: RUF001
    assert canonical_key("Cơ khí chế tạo máy") == canonical_key("Cơ khí chế tạo máy")
    assert course_key("Kinh tế vi mô") != course_key("Kinh tế vĩ mô")
    assert course_key("Điều khiển nhà máy điện*") != course_key("Điều khiển nhà máy điện")


def test_normalize_maps_non_active_student_status() -> None:
    row = _source_row()
    row["student_info"]["Trạng thái"] = "Tốt nghiệp"
    artifact = normalize_dataset(
        [row],
        [_mapping()],
        {"Kiểm thử phần mềm": "Khoa Test"},
    )
    assert artifact["students"][0]["status"] == "graduated"
