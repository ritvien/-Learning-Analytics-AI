import json
from unittest.mock import AsyncMock

import pytest

from scripts.import_v59_students import load_sources, sources_already_imported


def test_load_sources_deduplicates_by_student_code(tmp_path):
    first = tmp_path / "first.json"
    second = tmp_path / "second.json"
    first.write_text(
        json.dumps([{"student_info": {"MSSV": "SV01", "Họ và tên": "Old"}}]),
        encoding="utf-8",
    )
    second.write_text(
        json.dumps(
            [
                {"student_info": {"MSSV": "SV01", "Họ và tên": "New"}},
                {"student_info": {"MSSV": "SV02", "Họ và tên": "Second"}},
            ]
        ),
        encoding="utf-8",
    )

    rows = load_sources([first, second])

    assert [row["student_info"]["MSSV"] for row in rows] == ["SV01", "SV02"]
    assert rows[0]["student_info"]["Họ và tên"] == "New"


@pytest.mark.asyncio
async def test_sources_already_imported_checks_all_codes():
    connection = AsyncMock()
    connection.fetchval.return_value = 2
    rows = [
        {"student_info": {"MSSV": "SV01"}},
        {"student_info": {"MSSV": "SV02"}},
    ]

    assert await sources_already_imported(connection, rows) is True
    connection.fetchval.assert_awaited_once()
