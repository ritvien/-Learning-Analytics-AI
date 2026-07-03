"""Shared CTĐT corpus prep: program mapping, PDF classification, chunking."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# MVP demo programs — indexed first in Sprint 4.
MVP_SOURCE_FILES = frozenset(
    {
        "9_ Cong nghe thong tin.pdf",
        "22_ Khoa hoc du lieu.pdf",
        "30_ Tri tue nhan tao.pdf",
    }
)

CTDT_HEADING_PATTERNS = [
    re.compile(r"mục\s*tiêu\s*đào\s*tạo", re.IGNORECASE),
    re.compile(r"chuẩn\s*đầu\s*ra", re.IGNORECASE),
    re.compile(r"khối\s*kiến\s*thức", re.IGNORECASE),
    re.compile(r"học\s*phần", re.IGNORECASE),
    re.compile(r"chương\s*trình\s*đào\s*tạo", re.IGNORECASE),
    re.compile(r"\bPLO\b", re.IGNORECASE),
    re.compile(r"\bCDR\b", re.IGNORECASE),
]

# Catalog aligned with backend/db/supplement-academic-catalog.sql
PROGRAM_CATALOG: list[dict[str, str]] = [
    {"code": "7510301", "name": "Công nghệ kỹ thuật điện, điện tử"},
    {"code": "7510403", "name": "Công nghệ kỹ thuật năng lượng"},
    {"code": "7520115", "name": "Kỹ thuật nhiệt"},
    {"code": "7510601", "name": "Quản lý công nghiệp"},
    {"code": "7510602", "name": "Quản lý năng lượng"},
    {"code": "7510303", "name": "Công nghệ kỹ thuật điều khiển và tự động hoá"},
    {"code": "7510302", "name": "Công nghệ kỹ thuật điện tử - viễn thông"},
    {"code": "7480201", "name": "Công nghệ thông tin"},
    {"code": "7510406", "name": "Công nghệ kỹ thuật môi trường"},
    {"code": "7510201", "name": "Công nghệ kỹ thuật cơ khí"},
    {"code": "7510203", "name": "Công nghệ kỹ thuật cơ điện tử"},
    {"code": "7510102", "name": "Công nghệ kỹ thuật công trình xây dựng"},
    {"code": "7340101", "name": "Quản trị kinh doanh"},
    {"code": "7340201", "name": "Tài chính - Ngân hàng"},
    {"code": "7340301", "name": "Kế toán"},
    {"code": "7340302", "name": "Kiểm toán"},
    {"code": "7340122", "name": "Thương mại điện tử"},
    {"code": "7810103", "name": "Quản trị dịch vụ du lịch và lữ hành"},
    {"code": "7520107", "name": "Kỹ thuật Robot"},
    {"code": "7460108", "name": "Khoa học dữ liệu"},
    {"code": "7480106", "name": "Kỹ thuật máy tính"},
    {"code": "7510205", "name": "Công nghệ kỹ thuật ô tô"},
    {"code": "7810201", "name": "Quản trị khách sạn"},
    {"code": "7340115", "name": "Marketing"},
    {"code": "7340205", "name": "Công nghệ tài chính"},
    {"code": "7480107", "name": "Trí tuệ nhân tạo"},
    {"code": "7460117", "name": "Toán tin"},
    {"code": "7380107", "name": "Luật kinh tế"},
    {"code": "7220201", "name": "Ngôn ngữ Anh"},
    {"code": "7510402", "name": "Công nghệ vật liệu"},
    {"code": "7510407", "name": "Công nghệ kỹ thuật hạt nhân"},
    {"code": "7340120", "name": "Kinh doanh quốc tế"},
    {"code": "7480102", "name": "Mạng máy tính và truyền thông dữ liệu"},
    {"code": "7520117", "name": "Kỹ thuật công nghiệp"},
    {"code": "7520118", "name": "Kỹ thuật hệ thống công nghiệp"},
    {"code": "7520401", "name": "Vật lý kỹ thuật"},
    {"code": "7510605", "name": "Logistics và quản lý chuỗi cung ứng"},
]

# Manual overrides for filenames that fuzzy-match poorly.
FILENAME_OVERRIDES: dict[str, dict[str, str]] = {
    "415-QD ban hanh ban mo ta CTDT nganh CN tai chinh_0001_compressed.pdf": {
        "program_name": "Công nghệ tài chính",
        "program_code": "7340205",
        "status_hint": "admin_meta",
    },
    "38_ Quan ly xay dung.pdf": {
        "program_name": "Quản lý xây dựng",
        "program_code": "",
        "status_hint": "needs_review",
    },
    "1_ CNKT Cong trinh Xay dung.pdf": {
        "program_name": "Công nghệ kỹ thuật công trình xây dựng",
        "program_code": "7510102",
    },
    "2_ CNKT Co dien tu.pdf": {
        "program_name": "Công nghệ kỹ thuật cơ điện tử",
        "program_code": "7510203",
    },
}


@dataclass(frozen=True)
class ProgramMatch:
    program_name: str
    program_code: str
    source_id: str


def default_ctdt_artifact_dir() -> Path:
    return Path(__file__).resolve().parents[3] / "docs" / "20-RAG-Corpus-Preparation" / "ctdt"


def default_pdf_source_dir() -> Path:
    return Path(r"C:\Users\Admin\Work\AI In Action\crawl\pdf_ctdt")


def normalize_key(text: str) -> str:
    """Lowercase ASCII-ish key for fuzzy filename matching."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def strip_numeric_prefix(filename: str) -> str:
    stem = Path(filename).stem
    return re.sub(r"^\d+_\s*", "", stem).strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def estimate_token_count(text: str) -> int:
    # ~4 chars per token heuristic when tiktoken unavailable
    return max(1, len(text) // 4)


def match_program(filename: str, overrides: dict[str, dict[str, str]] | None = None) -> ProgramMatch:
    """Map PDF filename to program name/code."""
    overrides = overrides or FILENAME_OVERRIDES
    if filename in overrides:
        row = overrides[filename]
        code = row.get("program_code", "")
        name = row["program_name"]
        source_id = f"{code}-{normalize_key(strip_numeric_prefix(filename))}" if code else normalize_key(filename)
        return ProgramMatch(program_name=name, program_code=code, source_id=source_id)

    stem_key = normalize_key(strip_numeric_prefix(filename))
    best: tuple[int, dict[str, str]] | None = None
    for prog in PROGRAM_CATALOG:
        name_key = normalize_key(prog["name"])
        score = 0
        if stem_key == name_key:
            score = 100
        elif stem_key in name_key or name_key in stem_key:
            score = 80
        else:
            stem_tokens = set(stem_key.split())
            name_tokens = set(name_key.split())
            overlap = len(stem_tokens & name_tokens)
            if overlap >= 2:
                score = 50 + overlap * 5
        if best is None or score > best[0]:
            best = (score, prog)

    if best and best[0] >= 50:
        prog = best[1]
        source_id = f"{prog['code']}-{normalize_key(strip_numeric_prefix(filename))}"
        return ProgramMatch(program_name=prog["name"], program_code=prog["code"], source_id=source_id)

    source_id = normalize_key(strip_numeric_prefix(filename))
    return ProgramMatch(program_name=strip_numeric_prefix(filename), program_code="", source_id=source_id)


def classify_pdf_text(text: str, page_count: int) -> str:
    """Return usable_text or needs_ocr based on extracted text density."""
    chars = len(text.strip())
    if page_count <= 0:
        return "needs_ocr"
    avg = chars / page_count
    if avg >= 200 and chars >= 500:
        if any(p.search(text) for p in CTDT_HEADING_PATTERNS):
            return "usable_text"
        if avg >= 400:
            return "usable_text"
    return "needs_ocr"


def inventory_status(filename: str, text_status: str, overrides: dict[str, dict[str, str]] | None = None) -> str:
    overrides = overrides or FILENAME_OVERRIDES
    if filename in MVP_SOURCE_FILES:
        return "selected_for_mvp"
    hint = overrides.get(filename, {}).get("status_hint")
    if hint == "admin_meta":
        return "rejected_for_h62_mvp"
    if text_status == "needs_ocr":
        return "needs_ocr"
    return "usable_text"


def build_program_map(filenames: list[str], overrides: dict[str, dict[str, str]] | None = None) -> dict[str, Any]:
    entries = []
    for name in sorted(filenames):
        match = match_program(name, overrides)
        entries.append(
            {
                "file_name": name,
                "source_id": match.source_id,
                "program_name": match.program_name,
                "program_code": match.program_code,
                "mvp": name in MVP_SOURCE_FILES,
            }
        )
    return {"programs": entries, "mvp_files": sorted(MVP_SOURCE_FILES)}


def slugify(value: str) -> str:
    key = normalize_key(value)
    return re.sub(r"\s+", "-", key)


def make_document_id(program_code: str, source_file: str) -> str:
    stem = slugify(strip_numeric_prefix(source_file))
    prefix = program_code or "unknown"
    return f"{prefix}-{stem}"


def make_citation_label(program_name: str, source_file: str, page_start: int, page_end: int) -> str:
    return f"{program_name} - {source_file} - trang {page_start}-{page_end}"


def chunk_record(
    *,
    document_id: str,
    program_name: str,
    program_code: str,
    source_file: str,
    page_start: int,
    page_end: int,
    section_title: str,
    content: str,
    chunk_index: int,
) -> dict[str, Any]:
    section_slug = slugify(section_title) or "section"
    chunk_id = f"{program_code or 'unknown'}-{section_slug}-{chunk_index:03d}"
    return {
        "chunk_id": chunk_id,
        "document_id": document_id,
        "program_name": program_name,
        "program_code": program_code,
        "source_file": source_file,
        "page_start": page_start,
        "page_end": page_end,
        "section_title": section_title,
        "content": content.strip(),
        "content_sha256": sha256_text(content.strip()),
        "token_count": estimate_token_count(content),
        "citation_label": make_citation_label(program_name, source_file, page_start, page_end),
    }


def split_by_headings(full_text: str) -> list[tuple[str, str]]:
    """Split text into (section_title, body) pairs using CTĐT heading keywords."""
    lines = full_text.splitlines()
    sections: list[tuple[str, str]] = []
    current_title = "Tổng quan CTĐT"
    current_lines: list[str] = []

    def flush() -> None:
        body = "\n".join(current_lines).strip()
        if body:
            sections.append((current_title, body))

    for line in lines:
        stripped = line.strip()
        if not stripped:
            current_lines.append(line)
            continue
        is_heading = any(p.search(stripped) for p in CTDT_HEADING_PATTERNS) and len(stripped) < 120
        if is_heading:
            flush()
            current_title = stripped
            current_lines = []
        else:
            current_lines.append(line)
    flush()
    return sections


def window_chunks(text: str, *, min_tokens: int = 700, max_tokens: int = 1200, overlap_tokens: int = 125) -> list[str]:
    """Sliding window chunker by estimated token count."""
    words = text.split()
    if not words:
        return []
    min_words = min_tokens
    max_words = max_tokens
    overlap_words = overlap_tokens
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(len(words), start + max_words)
        if end - start < min_words and chunks:
            break
        piece = " ".join(words[start:end]).strip()
        if piece:
            chunks.append(piece)
        if end >= len(words):
            break
        start = max(0, end - overlap_words)
    return chunks


def chunks_from_text(
    *,
    full_text: str,
    document_id: str,
    program_name: str,
    program_code: str,
    source_file: str,
    page_start: int = 1,
    page_end: int = 1,
) -> list[dict[str, Any]]:
    sections = split_by_headings(full_text)
    records: list[dict[str, Any]] = []
    idx = 1
    if len(sections) <= 1 and len(full_text) > 2500:
        for piece in window_chunks(full_text):
            records.append(
                chunk_record(
                    document_id=document_id,
                    program_name=program_name,
                    program_code=program_code,
                    source_file=source_file,
                    page_start=page_start,
                    page_end=page_end,
                    section_title="Nội dung CTĐT",
                    content=piece,
                    chunk_index=idx,
                )
            )
            idx += 1
        return records

    for title, body in sections:
        if estimate_token_count(body) > 1400:
            for piece in window_chunks(body):
                records.append(
                    chunk_record(
                        document_id=document_id,
                        program_name=program_name,
                        program_code=program_code,
                        source_file=source_file,
                        page_start=page_start,
                        page_end=page_end,
                        section_title=title,
                        content=piece,
                        chunk_index=idx,
                    )
                )
                idx += 1
        else:
            records.append(
                chunk_record(
                    document_id=document_id,
                    program_name=program_name,
                    program_code=program_code,
                    source_file=source_file,
                    page_start=page_start,
                    page_end=page_end,
                    section_title=title,
                    content=body,
                    chunk_index=idx,
                )
            )
            idx += 1
    return records


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
