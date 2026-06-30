# Plan H62 + H63: CTĐT RAG Corpus + pgvector Index

## Summary
- H62 chuẩn bị corpus CTĐT từ `C:\Users\Admin\Work\AI In Action\crawl\pdf_ctdt`.
- H63 tạo hạ tầng `pgvector`, ingest chunks, embedding và smoke top-k retrieval.
- Phạm vi MVP đã chốt: audit đủ 38 PDF, OCR/index trước 3 ngành demo:
  - `9_ Cong nghe thong tin.pdf`
  - `22_ Khoa hoc du lieu.pdf`
  - `30_ Tri tue nhan tao.pdf`
- Không bind retrieval vào LangGraph agent trong H63; phần đó để H51.

## H62: Corpus Prep
- Tạo thư mục artifact: `docs/20-RAG-Corpus-Preparation/ctdt/`.
- Sinh `source-inventory.csv` cho 38 PDF gồm: `source_id`, `file_name`, `program_name`, `program_code` nếu map được, `sha256`, `page_count`, `file_size`, `text_extract_chars`, `status`.
- Đánh dấu chất lượng PDF:
  - `usable_text` nếu extract text trực tiếp đủ dùng.
  - `needs_ocr` nếu scan/image.
  - `selected_for_mvp` cho 3 ngành ưu tiên.
  - `rejected_for_h62_mvp` cho PDF chưa OCR trong MVP, không coi là lỗi.
- OCR 3 PDF MVP bằng PyMuPDF render page ảnh và Gemini vision, fail-fast nếu thiếu `GEMINI_API_KEY`.
- Chuẩn hóa output thành `ctdt_chunks.jsonl`, mỗi chunk có:
  - `chunk_id`, `document_id`, `program_name`, `source_file`
  - `page_start`, `page_end`, `section_title`
  - `content`, `content_sha256`, `token_count`
  - `citation_label` dạng `Tên ngành - file.pdf - trang X-Y`
- Chunk theo mục CTĐT nếu OCR nhận diện được heading; nếu không, chunk theo page/window 700-1200 tokens, overlap 100-150 tokens.
- Tạo `smoke-queries.json` gồm ít nhất 6 câu cho H51/H61, ví dụ: mục tiêu đào tạo, chuẩn đầu ra, khối kiến thức, học phần bắt buộc của CNTT/KHDL/TTNT.

## H63: pgvector + Ingest
- Đổi dev DB image trong `docker-compose.yml` từ `postgres:16-alpine` sang image có pgvector, ví dụ `pgvector/pgvector:pg16`.
- Thêm Alembic migration mới, không sửa migration cũ:
  - `CREATE SCHEMA IF NOT EXISTS rag`
  - `CREATE EXTENSION IF NOT EXISTS vector`
  - bảng `rag.ctdt_documents`
  - bảng `rag.ctdt_chunks` với `embedding vector(1536)`
  - index metadata theo `program_name`, `document_id`, `page_start`
  - HNSW cosine index cho `embedding`
- Chọn embedding model: `text-embedding-3-small`, dimension `1536`.
- Bổ sung config:
  - `RAG_EMBEDDING_MODEL=text-embedding-3-small`
  - dùng `OPENAI_API_KEY` hoặc `LLM_API_KEY`
- Tạo script idempotent `backend/scripts/ingest_ctdt_rag.py`:
  - đọc `ctdt_chunks.jsonl`
  - upsert document/chunk theo `document_id`, `chunk_id`, `content_sha256`
  - chỉ re-embed chunk khi content/model đổi
  - có `--dry-run`, `--limit`, `--program`
- Tạo retrieval smoke script hoặc test helper:
  - embed query
  - lọc optional theo `program_name`
  - query top-k bằng cosine distance
  - trả `chunk_id`, score, citation, page, snippet
- Không dùng RAG cho điểm, CLO cá nhân, dropout hoặc analytics SQL.

## Public Interfaces / Contracts
- New DB schema: `rag`.
- New tables:
  - `rag.ctdt_documents`: metadata PDF/source/status.
  - `rag.ctdt_chunks`: searchable chunk + citation + embedding.
- New script:
  - `python backend/scripts/ingest_ctdt_rag.py --input docs/20-RAG-Corpus-Preparation/ctdt/ctdt_chunks.jsonl`
- Retrieval contract for H51:
  - input: query text, optional `program_name`, `top_k`
  - output: list of chunks with `content`, `score`, `citation_label`, `source_file`, `page_start`, `page_end`, `section_title`.

## Test Plan
- H62:
  - run inventory and confirm `38` PDFs discovered.
  - confirm 3 MVP PDFs have chunks and citations.
  - confirm scan PDFs outside MVP are recorded, not silently skipped.
- H63:
  - run Alembic upgrade on Postgres pgvector image.
  - run ingest twice and verify chunk/document counts do not duplicate.
  - smoke retrieval for:
    - “Chuẩn đầu ra ngành Công nghệ thông tin là gì?”
    - “Ngành Trí tuệ nhân tạo có các khối kiến thức nào?”
    - “Mục tiêu đào tạo ngành Khoa học dữ liệu?”
  - run `cd backend; ruff check .; pytest -q -m "not slow and not eval and not integration"`.

## Implementation status (2026-06-30)

- [x] H62 artifacts: `docs/20-RAG-Corpus-Preparation/ctdt/` (38 PDF inventory, 12 MVP chunks, smoke queries)
- [x] H62 scripts: `prepare_ctdt_inventory.py`, `extract_ctdt_corpus.py` (Gemini OCR + demo fallback)
- [x] H63: `pgvector/pgvector:pg16`, migration `c5d6e7f8a9b0`, `ingest_ctdt_rag.py`, `app/rag/ctdt_retrieval.py`
- [x] Config: `RAG_EMBEDDING_MODEL`, `RAG_EMBEDDING_DIMENSION`
- [ ] H51: LangGraph tool wiring (next task)

## Assumptions
- MVP index 3 ngành demo trước; 35 PDF còn lại có manifest và trạng thái `needs_ocr`.
- `GEMINI_API_KEY` dùng cho OCR scan; `OPENAI_API_KEY` hoặc `LLM_API_KEY` dùng cho embedding.
- H63 chỉ làm storage/index/retrieval smoke; LangGraph tool, prompt routing, citation answer format thuộc H51.
- Nếu môi trường deploy không hỗ trợ `pgvector`, D59/H51 phải dùng Postgres instance có extension `vector`; không fallback sang Chroma vì ADR-004 đã chốt pgvector.
