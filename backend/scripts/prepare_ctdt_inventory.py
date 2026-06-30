#!/usr/bin/env python3
"""Build CTĐT PDF inventory from crawl source directory."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Missing pymupdf. Install: pip install -e '.[corpus]'")
    sys.exit(1)

from app.rag.ctdt_corpus import (
    build_program_map,
    classify_pdf_text,
    default_ctdt_artifact_dir,
    default_pdf_source_dir,
    inventory_status,
    match_program,
    sha256_bytes,
)


def extract_pdf_stats(pdf_path: Path) -> tuple[int, str]:
    doc = fitz.open(pdf_path)
    page_count = len(doc)
    texts: list[str] = []
    for page in doc:
        texts.append(page.get_text("text"))
    doc.close()
    return page_count, "\n".join(texts)


def run_inventory(source_dir: Path, output_dir: Path, dry_run: bool = False) -> list[dict[str, str]]:
    pdfs = sorted(source_dir.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"No PDF files found in {source_dir}")

    program_map = build_program_map([p.name for p in pdfs])
    rows: list[dict[str, str]] = []

    for pdf_path in pdfs:
        data = pdf_path.read_bytes()
        page_count, text = extract_pdf_stats(pdf_path)
        text_status = classify_pdf_text(text, page_count)
        match = match_program(pdf_path.name)
        status = inventory_status(pdf_path.name, text_status)
        rows.append(
            {
                "source_id": match.source_id,
                "file_name": pdf_path.name,
                "program_name": match.program_name,
                "program_code": match.program_code,
                "sha256": sha256_bytes(data),
                "page_count": str(page_count),
                "file_size": str(len(data)),
                "text_extract_chars": str(len(text.strip())),
                "status": status,
            }
        )

    if dry_run:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return rows

    output_dir.mkdir(parents=True, exist_ok=True)
    map_path = output_dir / "program-map.json"
    map_path.write_text(json.dumps(program_map, ensure_ascii=False, indent=2), encoding="utf-8")

    inventory_path = output_dir / "source-inventory.csv"
    fieldnames = [
        "source_id",
        "file_name",
        "program_name",
        "program_code",
        "sha256",
        "page_count",
        "file_size",
        "text_extract_chars",
        "status",
    ]
    with inventory_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows -> {inventory_path}")
    print(f"Wrote program map -> {map_path}")
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare CTĐT PDF inventory.")
    parser.add_argument("--source-dir", type=Path, default=default_pdf_source_dir())
    parser.add_argument("--output-dir", type=Path, default=default_ctdt_artifact_dir())
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.source_dir.exists():
        print(f"Source directory not found: {args.source_dir}", file=sys.stderr)
        sys.exit(1)

    rows = run_inventory(args.source_dir, args.output_dir, dry_run=args.dry_run)
    mvp_count = sum(1 for r in rows if r["status"] == "selected_for_mvp")
    print(f"Inventory complete: {len(rows)} PDFs, {mvp_count} MVP selected")


if __name__ == "__main__":
    main()
