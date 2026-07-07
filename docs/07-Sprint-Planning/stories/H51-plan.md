# Kế Hoạch H51 — CTĐT RAG Q&A MVP

## Summary
- Mục tiêu: nối CTĐT retrieval đã có từ H63 vào Universal Chat Agent để trả lời câu hỏi về ngành, mục tiêu đào tạo, CDR/PLO, khối kiến thức, học phần, kèm citation file/trang/section.
- Phạm vi MVP: 3 ngành đã index từ H62/H63: Công nghệ thông tin, Khoa học dữ liệu, Trí tuệ nhân tạo.
- Không dùng CTĐT RAG cho điểm, CLO cá nhân, dropout, hoặc suy luận xác suất ML. Không thêm schema/migration/frontend mới.

## Key Changes
- Thêm internal LangGraph tool `search_ctdt_program_info(query, program_name=None, top_k=4)` trong backend agent.
- Tool gọi `app.rag.ctdt_retrieval.search_ctdt_chunks`, clamp `top_k` từ 1 đến 5, trả JSON gồm `status`, `query`, `program_name`, `hits`.
- Mỗi hit trả `content`, `score`, `citation_label`, `source_file`, `page_start`, `page_end`, `section_title`, `program_name`, `program_code`.
- Hỗ trợ alias chương trình: `CNTT`/`7480201`, `KHDL`/`7460108`, `TTNT`/`7480107`; ngành ngoài MVP trả thông báo chưa được index.
- Đăng ký tool mới vào `_BASE_TOOLS` để ReAct loop và SSE `tool_call/tool_result` hiện hoạt động tự nhiên, không đổi API response shape.
- Cập nhật router prompt để câu hỏi CTĐT/CDR/PLO/chương trình đào tạo/mục tiêu/khối kiến thức/học phần đi `core_agent` với `needs_tools=true`.
- Cập nhật core prompt version và policy: mọi câu trả lời CTĐT chính thức phải dùng `search_ctdt_program_info`; nếu không có citation thì từ chối mềm; cuối câu trả lời có mục `Nguồn` nêu file, trang, section.
- Giữ H49 boundary: dropout chỉ qua ML tool, CLO cá nhân chỉ qua CLO tool, analytics chỉ qua DWH/view whitelist.

## Public Interfaces / Contracts
- Không đổi HTTP API: `POST /api/v1/chat`, `POST /api/v1/chat/stream`, session APIs giữ nguyên.
- Không đổi frontend types/SSE event union; tool mới chỉ xuất hiện như một `tool_call` name mới.
- New internal tool contract:
  - Input: `query: str`, `program_name?: str`, `top_k?: int`
  - Output OK: JSON string với `status="ok"` và `hits` có citation.
  - Output empty/unsupported/error: string bắt đầu `ERROR:` để agent không bịa dữ liệu.

## Test Plan
- Unit tests tool H51:
  - Alias `CNTT`, `KHDL`, `TTNT` map đúng program_name trước khi gọi retrieval.
  - Tool trả hit có `citation_label`, file, page, section, content.
  - Unsupported program trả `ERROR` và không gọi retrieval.
  - Empty hits hoặc score dưới ngưỡng trả thông báo không có nguồn phù hợp.
  - `top_k` được clamp tối đa 5.
- Prompt/registry tests:
  - `TOOLS` chứa `search_ctdt_program_info`.
  - Core prompt nhắc bắt buộc citation file/page/section cho CTĐT.
  - Router prompt định tuyến CTĐT/CDR/PLO/curriculum sang `core_agent`.
  - Prompt manifest checksum/version cập nhật hợp lệ.
- Integration smoke:
  - Dùng 3 câu trong `docs/20-RAG-Corpus-Preparation/ctdt/smoke-queries.json` qua tool mới, marked `integration`, skip nếu thiếu DB/embedding key.
- Verification commands:
  - `cd backend; ruff check app/agent app/rag tests`
  - `cd backend; pytest -q --no-cov -p no:cacheprovider tests/test_ctdt_* tests/test_chat_scope_h49.py tests/test_prompt_versioning_h59.py`
  - Optional local smoke: `cd backend; pytest -q -m integration tests/test_ctdt_retrieval_smoke.py`

## Assumptions
- Worktree hiện có thay đổi chưa commit ở `AGENTS.md`, `backend/app/agent/prompts.py`, `docs/README.md`; implementer phải đọc diff trước khi sửa để không ghi đè thay đổi của người khác.
- H63 ingest đã chạy ở môi trường demo; nếu DB chưa có `rag.ctdt_chunks`, H51 code vẫn trả lỗi an toàn thay vì bịa câu trả lời.
- Frontend chat hiện đã hiển thị markdown và stream status chung, nên citation sẽ nằm trong nội dung trả lời, không cần UI riêng cho H51.

## Implementation Status (2026-07-01)
- [x] `search_ctdt_program_info` implemented and registered in Universal Chat.
- [x] Router/core prompt policy updated and prompt versions bumped.
- [x] Alias/query program detection added; non-MVP programs are refused before retrieval.
- [x] Unit/regression verification passed: 41 H51 tests, 85-test H51/H49/H59/H64/corpus bundle.
- [x] Tool-level integration smoke added; skipped locally without DB/embedding key.
