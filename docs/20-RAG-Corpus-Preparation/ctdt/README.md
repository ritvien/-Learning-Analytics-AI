# CTĐT RAG Corpus (H62)

Artifact directory for Sprint 4 CTĐT RAG pipeline (`H62 → H63 → H51`).

Current status (01/07/2026): H51 is implemented. Universal Chat uses `search_ctdt_program_info()` for CTĐT/CDR/PLO questions, returns citation file/page/section, and refuses non-MVP programs before retrieval.

## Source

- PDF crawl: `C:\Users\Admin\Work\AI In Action\crawl\pdf_ctdt` (38 files)
- MVP indexed first: CNTT, KHDL, TTNT

## Generate artifacts

```powershell
cd backend
pip install -e ".[corpus]"

# 1) Inventory all PDFs
python scripts/prepare_ctdt_inventory.py

# 2) Extract chunks (MVP). Uses Gemini OCR; falls back to demo text if OCR quota fails.
python scripts/extract_ctdt_corpus.py --program mvp

# 3) Ingest into pgvector (H63)
python scripts/ingest_ctdt_rag.py --input ../docs/20-RAG-Corpus-Preparation/ctdt/ctdt_chunks.jsonl
```

## Environment

| Variable | Purpose |
|:---------|:--------|
| `GEMINI_API_KEY` | OCR for scan PDFs |
| `OPENAI_API_KEY` or `LLM_API_KEY` | Embeddings (`text-embedding-3-small`) |

## Files

| File | Description |
|:-----|:------------|
| `source-inventory.csv` | 38 PDF audit (checksum, status, program map) |
| `program-map.json` | Filename → program name/code |
| `ctdt_chunks.jsonl` | Chunk + citation contract for ingest |
| `smoke-queries.json` | ≥6 queries for H51/H61 retrieval smoke |
| `ocr_cache/` | Cached OCR text per PDF sha256 (gitignored) |

## Status values

- `selected_for_mvp` — 3 demo ngành, chunked in Sprint 4
- `needs_ocr` — scan PDF, not OCR'd in MVP
- `usable_text` — text layer sufficient
- `rejected_for_h62_mvp` — admin/meta PDF, out of MVP scope

## Handoff to H51

Retrieval contract: `backend/app/rag/ctdt_retrieval.py` → `search_ctdt_chunks(query, program_name?, top_k)`.

Returns: `chunk_id`, `score`, `content`, `citation_label`, `source_file`, `page_start`, `page_end`, `section_title`.

H51 agent tool: `backend/app/agent/tools.py` → `search_ctdt_program_info(query, program_name?, top_k?)`.

Supported MVP programs: Công nghệ thông tin, Khoa học dữ liệu, Trí tuệ nhân tạo.
