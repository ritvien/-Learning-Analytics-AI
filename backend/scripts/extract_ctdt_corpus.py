#!/usr/bin/env python3
"""Extract and chunk CTĐT PDFs for RAG corpus (H62)."""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from io import BytesIO
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Missing pymupdf. Install: pip install -e '.[corpus]'")
    sys.exit(1)

from app.rag.ctdt_corpus import (
    MVP_SOURCE_FILES,
    chunks_from_text,
    default_ctdt_artifact_dir,
    default_pdf_source_dir,
    load_jsonl,
    make_document_id,
    match_program,
    sha256_bytes,
    write_jsonl,
)
from app.rag.ctdt_demo_content import DEMO_CTDT_TEXT


def _load_gemini_client():
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        from dotenv import load_dotenv

        load_dotenv(Path(__file__).resolve().parents[2] / ".env")
        load_dotenv(Path(__file__).resolve().parents[2] / "backend" / ".env")
        api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for OCR on scan PDFs")
    from google import genai

    return genai.Client(api_key=api_key)


def extract_text_layer(pdf_path: Path) -> tuple[int, str]:
    doc = fitz.open(pdf_path)
    page_count = len(doc)
    pages: list[str] = []
    for page in doc:
        pages.append(page.get_text("text"))
    doc.close()
    return page_count, "\n".join(pages)


def ocr_pdf_with_gemini(pdf_path: Path, cache_dir: Path, force: bool = False) -> str:
    data = pdf_path.read_bytes()
    digest = sha256_bytes(data)
    cache_path = cache_dir / f"{digest}.txt"
    if cache_path.exists() and not force:
        return cache_path.read_text(encoding="utf-8")

    try:
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError("pillow required for OCR") from exc

    client = _load_gemini_client()
    doc = fitz.open(pdf_path)
    page_texts: list[str] = []
    prompt = (
        "Extract all readable Vietnamese text from this CTĐT (curriculum) PDF page. "
        "Preserve section headings. Return plain text only, no markdown."
    )

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        pix = page.get_pixmap(dpi=150)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, img],
        )
        text = (response.text or "").strip()
        if text:
            page_texts.append(f"--- Page {page_num + 1} ---\n{text}")
    doc.close()

    full_text = "\n\n".join(page_texts)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(full_text, encoding="utf-8")
    return full_text


def demo_text_for_program(program_code: str) -> str | None:
    return DEMO_CTDT_TEXT.get(program_code)


def read_inventory(inventory_path: Path) -> list[dict[str, str]]:
    with inventory_path.open(encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def should_process(row: dict[str, str], program_filter: str | None) -> bool:
    if program_filter == "mvp":
        return row["file_name"] in MVP_SOURCE_FILES
    if program_filter:
        return row["program_name"].lower() == program_filter.lower()
    return row["status"] in {"selected_for_mvp", "usable_text"}


def extract_corpus(
    *,
    source_dir: Path,
    output_dir: Path,
    inventory_path: Path,
    program_filter: str | None,
    limit: int | None,
    dry_run: bool,
    force_reocr: bool,
    demo_fallback: bool,
) -> list[dict]:
    if not inventory_path.exists():
        raise FileNotFoundError(f"Run prepare_ctdt_inventory.py first: {inventory_path}")

    rows = [r for r in read_inventory(inventory_path) if should_process(r, program_filter)]
    if limit is not None:
        rows = rows[:limit]

    all_chunks: list[dict] = []
    cache_dir = output_dir / "ocr_cache"

    for row in rows:
        pdf_path = source_dir / row["file_name"]
        if not pdf_path.exists():
            print(f"Skip missing PDF: {pdf_path}", file=sys.stderr)
            continue

        match = match_program(row["file_name"])
        document_id = make_document_id(match.program_code, row["file_name"])
        page_count, text = extract_text_layer(pdf_path)
        avg_chars = len(text.strip()) / max(page_count, 1)

        if avg_chars < 200 or row["status"] == "needs_ocr":
            try:
                print(f"OCR {row['file_name']} ({page_count} pages)...")
                text = ocr_pdf_with_gemini(pdf_path, cache_dir, force=force_reocr)
                page_count = max(page_count, text.count("--- Page"))
            except Exception as exc:
                demo = demo_text_for_program(match.program_code)
                if demo_fallback and demo:
                    print(f"  OCR failed ({type(exc).__name__}); using demo fallback for {match.program_code}")
                    text = demo
                else:
                    raise

        chunks = chunks_from_text(
            full_text=text,
            document_id=document_id,
            program_name=match.program_name,
            program_code=match.program_code,
            source_file=row["file_name"],
            page_start=1,
            page_end=max(page_count, 1),
        )
        print(f"  -> {len(chunks)} chunks")
        all_chunks.extend(chunks)

    if dry_run:
        print(json.dumps(all_chunks[:3], ensure_ascii=False, indent=2))
        return all_chunks

    out_path = output_dir / "ctdt_chunks.jsonl"
    write_jsonl(out_path, all_chunks)
    print(f"Wrote {len(all_chunks)} chunks -> {out_path}")
    return all_chunks


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract CTĐT corpus chunks.")
    parser.add_argument("--source-dir", type=Path, default=default_pdf_source_dir())
    parser.add_argument("--output-dir", type=Path, default=default_ctdt_artifact_dir())
    parser.add_argument("--inventory", type=Path, default=None)
    parser.add_argument("--program", type=str, default="mvp", help="Filter: mvp | program name | all")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force-reocr", action="store_true")
    parser.add_argument(
        "--demo-fallback",
        action="store_true",
        default=True,
        help="Use structured demo CTĐT text when OCR fails (default: true)",
    )
    parser.add_argument("--no-demo-fallback", action="store_false", dest="demo_fallback")
    args = parser.parse_args()

    output_dir = args.output_dir
    inventory_path = args.inventory or (output_dir / "source-inventory.csv")
    program_filter = None if args.program.lower() == "all" else args.program

    if not args.source_dir.exists():
        print(f"Source directory not found: {args.source_dir}", file=sys.stderr)
        sys.exit(1)

    extract_corpus(
        source_dir=args.source_dir,
        output_dir=output_dir,
        inventory_path=inventory_path,
        program_filter=program_filter,
        limit=args.limit,
        dry_run=args.dry_run,
        force_reocr=args.force_reocr,
        demo_fallback=args.demo_fallback,
    )


if __name__ == "__main__":
    main()
