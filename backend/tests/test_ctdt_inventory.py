"""Tests for CTĐT corpus inventory and chunk schema."""

from __future__ import annotations

import csv
import json
from pathlib import Path

from app.rag.ctdt_corpus import (
    MVP_SOURCE_FILES,
    build_program_map,
    chunks_from_text,
    classify_pdf_text,
    inventory_status,
    load_jsonl,
    match_program,
)

ARTIFACT_DIR = Path(__file__).resolve().parents[2] / "docs" / "20-RAG-Corpus-Preparation" / "ctdt"


def test_inventory_has_38_pdfs() -> None:
    inventory_path = ARTIFACT_DIR / "source-inventory.csv"
    assert inventory_path.exists(), "Run prepare_ctdt_inventory.py first"
    with inventory_path.open(encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    assert len(rows) == 38


def test_mvp_files_marked_selected() -> None:
    inventory_path = ARTIFACT_DIR / "source-inventory.csv"
    with inventory_path.open(encoding="utf-8") as fh:
        rows = {r["file_name"]: r for r in csv.DictReader(fh)}
    for name in MVP_SOURCE_FILES:
        assert rows[name]["status"] == "selected_for_mvp"


def test_program_map_matches_inventory_count() -> None:
    program_map_path = ARTIFACT_DIR / "program-map.json"
    assert program_map_path.exists()
    data = json.loads(program_map_path.read_text(encoding="utf-8"))
    assert len(data["programs"]) == 38
    assert set(data["mvp_files"]) == set(MVP_SOURCE_FILES)


def test_mvp_chunks_jsonl_schema() -> None:
    chunks_path = ARTIFACT_DIR / "ctdt_chunks.jsonl"
    assert chunks_path.exists(), "Run extract_ctdt_corpus.py --program mvp"
    rows = load_jsonl(chunks_path)
    assert len(rows) >= 3
    required = {
        "chunk_id",
        "document_id",
        "program_name",
        "source_file",
        "content",
        "content_sha256",
        "citation_label",
    }
    programs = {r["program_name"] for r in rows}
    assert "Công nghệ thông tin" in programs
    assert "Khoa học dữ liệu" in programs
    assert "Trí tuệ nhân tạo" in programs
    for row in rows:
        assert required.issubset(row.keys())
        assert "trang" in row["citation_label"]


def test_match_program_mvp_codes() -> None:
    match = match_program("9_ Cong nghe thong tin.pdf")
    assert match.program_code == "7480201"
    assert match.program_name == "Công nghệ thông tin"


def test_classify_pdf_text_needs_ocr_when_empty() -> None:
    assert classify_pdf_text("", 10) == "needs_ocr"


def test_inventory_status_mvp() -> None:
    assert inventory_status("9_ Cong nghe thong tin.pdf", "needs_ocr") == "selected_for_mvp"


def test_chunks_from_text_produces_citation() -> None:
    chunks = chunks_from_text(
        full_text="Mục tiêu đào tạo\nĐào tạo kỹ sư CNTT.",
        document_id="7480201-test",
        program_name="Công nghệ thông tin",
        program_code="7480201",
        source_file="9_ Cong nghe thong tin.pdf",
    )
    assert len(chunks) >= 1
    assert chunks[0]["citation_label"].startswith("Công nghệ thông tin")


def test_build_program_map_from_filenames() -> None:
    data = build_program_map(["22_ Khoa hoc du lieu.pdf"])
    assert data["programs"][0]["program_code"] == "7460108"
