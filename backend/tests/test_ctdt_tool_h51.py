"""H51 — CTĐT RAG Q&A tool unit tests.

Covers:
  1. Alias mapping: CNTT, KHDL, TTNT, program codes → canonical names.
  2. Hit structure: tool returns JSON with citation fields.
  3. Unsupported program: returns ERROR without calling retrieval.
  4. Empty hits / low score: returns informative error string.
  5. top_k clamping: values clamped to [1, 5].
  6. Prompt/registry: tool registered, prompts contain CTĐT routing/citation.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.agent.tools import (
    _MIN_SCORE_THRESHOLD,
    _MVP_PROGRAMS,
    _PROGRAM_ALIASES,
    detect_program_from_query,
    resolve_program_alias,
    search_ctdt_program_info,
)

# ── 1. Alias mapping tests ────────────────────────────────────────────


class TestResolveAlias:
    """resolve_program_alias maps abbreviations and codes correctly."""

    def test_cntt_alias(self) -> None:
        assert resolve_program_alias("CNTT") == "Công nghệ thông tin"

    def test_khdl_alias(self) -> None:
        assert resolve_program_alias("KHDL") == "Khoa học dữ liệu"

    def test_ttnt_alias(self) -> None:
        assert resolve_program_alias("TTNT") == "Trí tuệ nhân tạo"

    def test_code_7480201(self) -> None:
        assert resolve_program_alias("7480201") == "Công nghệ thông tin"

    def test_code_7460108(self) -> None:
        assert resolve_program_alias("7460108") == "Khoa học dữ liệu"

    def test_code_7480107(self) -> None:
        assert resolve_program_alias("7480107") == "Trí tuệ nhân tạo"

    def test_full_name_case_insensitive(self) -> None:
        assert resolve_program_alias("công nghệ thông tin") == "Công nghệ thông tin"

    def test_none_returns_none(self) -> None:
        assert resolve_program_alias(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert resolve_program_alias("") is None

    def test_unknown_program_returns_original(self) -> None:
        assert resolve_program_alias("Quản trị kinh doanh") == "Quản trị kinh doanh"

    def test_whitespace_stripped(self) -> None:
        assert resolve_program_alias("  CNTT  ") == "Công nghệ thông tin"

    def test_accentless_full_name(self) -> None:
        assert resolve_program_alias("Cong nghe thong tin") == "Công nghệ thông tin"

    def test_detects_mvp_program_from_query(self) -> None:
        assert detect_program_from_query("Chuẩn đầu ra ngành CNTT là gì?") == "Công nghệ thông tin"

    def test_detects_non_mvp_program_from_query(self) -> None:
        assert detect_program_from_query("Mục tiêu đào tạo ngành QTKD?") == "Quản trị kinh doanh"

    def test_alias_map_covers_all_mvp(self) -> None:
        """Every MVP program should be reachable through at least one alias."""
        reachable = set(_PROGRAM_ALIASES.values())
        for prog in _MVP_PROGRAMS:
            assert prog in reachable, f"MVP program '{prog}' not reachable from aliases"


# ── 2. Hit structure tests ─────────────────────────────────────────────


def _make_mock_hit(**overrides):
    """Create a mock CtdtRetrievalHit with sensible defaults."""
    from app.rag.ctdt_retrieval import CtdtRetrievalHit

    defaults = {
        "chunk_id": "chunk-001",
        "score": 0.85,
        "content": "Mục tiêu đào tạo ngành CNTT...",
        "citation_label": "CTĐT CNTT — Mục tiêu đào tạo",
        "source_file": "9_ Cong nghe thong tin.pdf",
        "page_start": 3,
        "page_end": 4,
        "section_title": "Mục tiêu đào tạo",
        "program_name": "Công nghệ thông tin",
        "program_code": "7480201",
    }
    defaults.update(overrides)
    return CtdtRetrievalHit(**defaults)


class TestHitStructure:
    """search_ctdt_program_info returns properly structured JSON with citations."""

    @pytest.mark.asyncio
    async def test_ok_response_has_citation_fields(self) -> None:
        mock_hit = _make_mock_hit()

        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[mock_hit],
        ):
            result = await search_ctdt_program_info.coroutine(
                query="Mục tiêu đào tạo ngành CNTT",
                program_name="CNTT",
            )

        data = json.loads(result)
        assert data["status"] == "ok"
        assert data["program_name"] == "Công nghệ thông tin"
        assert len(data["hits"]) == 1

        hit = data["hits"][0]
        assert "citation_label" in hit
        assert "source_file" in hit
        assert "page_start" in hit
        assert "page_end" in hit
        assert "section_title" in hit
        assert "content" in hit
        assert "score" in hit
        assert "program_name" in hit
        assert "program_code" in hit

    @pytest.mark.asyncio
    async def test_ok_response_preserves_query(self) -> None:
        mock_hit = _make_mock_hit()

        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[mock_hit],
        ):
            result = await search_ctdt_program_info.coroutine(
                query="Chuẩn đầu ra ngành CNTT",
                program_name="CNTT",
            )

        data = json.loads(result)
        assert data["query"] == "Chuẩn đầu ra ngành CNTT"

    @pytest.mark.asyncio
    async def test_multiple_hits_returned(self) -> None:
        hits = [
            _make_mock_hit(chunk_id="c-1", score=0.9),
            _make_mock_hit(chunk_id="c-2", score=0.7),
        ]

        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=hits,
        ):
            result = await search_ctdt_program_info.coroutine(
                query="Khối kiến thức CNTT",
                program_name="CNTT",
            )

        data = json.loads(result)
        assert len(data["hits"]) == 2


# ── 3. Unsupported program tests ──────────────────────────────────────


class TestUnsupportedProgram:
    """Tool rejects non-MVP programs without calling retrieval."""

    @pytest.mark.asyncio
    async def test_unsupported_returns_error(self) -> None:
        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
        ) as mock_search:
            result = await search_ctdt_program_info.coroutine(
                query="Chuẩn đầu ra ngành QTKD",
                program_name="QTKD",
            )

        assert result.startswith("ERROR:")
        assert "chưa được lập chỉ mục" in result
        mock_search.assert_not_called()

    @pytest.mark.asyncio
    async def test_unsupported_code_returns_error(self) -> None:
        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
        ) as mock_search:
            result = await search_ctdt_program_info.coroutine(
                query="Mục tiêu ngành Kế toán",
                program_name="7340301",
            )

        assert result.startswith("ERROR:")
        mock_search.assert_not_called()

    @pytest.mark.asyncio
    async def test_none_program_searches_all(self) -> None:
        """program_name=None should NOT trigger MVP rejection — it searches all indexed programs."""
        mock_hit = _make_mock_hit()

        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[mock_hit],
        ) as mock_search:
            result = await search_ctdt_program_info.coroutine(
                query="Khối kiến thức chung",
                program_name=None,
            )

        mock_search.assert_called_once()
        data = json.loads(result)
        assert data["status"] == "ok"


# ── 4. Empty / low-score hits tests ───────────────────────────────────


    @pytest.mark.asyncio
    async def test_none_program_infers_mvp_program_from_query(self) -> None:
        """If program_name is omitted, the tool still filters by the program in query."""
        mock_hit = _make_mock_hit()

        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[mock_hit],
        ) as mock_search:
            result = await search_ctdt_program_info.coroutine(
                query="Chuẩn đầu ra ngành CNTT là gì?",
                program_name=None,
            )

        _, kwargs = mock_search.call_args
        assert kwargs["program_name"] == "Công nghệ thông tin"
        data = json.loads(result)
        assert data["program_name"] == "Công nghệ thông tin"
        assert data["program_name_inferred"] is True

    @pytest.mark.asyncio
    async def test_none_program_rejects_non_mvp_program_from_query(self) -> None:
        """Non-MVP programs are rejected even when the LLM omits program_name."""
        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
        ) as mock_search:
            result = await search_ctdt_program_info.coroutine(
                query="Chuẩn đầu ra ngành QTKD là gì?",
                program_name=None,
            )

        assert result.startswith("ERROR:")
        assert "Quản trị kinh doanh" in result
        mock_search.assert_not_called()


class TestEmptyAndLowScore:
    """Tool returns descriptive error when no useful results."""

    @pytest.mark.asyncio
    async def test_empty_hits_returns_error(self) -> None:
        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await search_ctdt_program_info.coroutine(
                query="xyz random query",
                program_name="CNTT",
            )

        assert result.startswith("ERROR:")
        assert "Không tìm thấy nguồn phù hợp" in result

    @pytest.mark.asyncio
    async def test_low_score_hits_filtered_out(self) -> None:
        low_hit = _make_mock_hit(score=_MIN_SCORE_THRESHOLD - 0.01)

        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[low_hit],
        ):
            result = await search_ctdt_program_info.coroutine(
                query="something vague",
                program_name="CNTT",
            )

        assert result.startswith("ERROR:")

    @pytest.mark.asyncio
    async def test_mix_scores_keeps_good_hits(self) -> None:
        good_hit = _make_mock_hit(chunk_id="good", score=0.8)
        bad_hit = _make_mock_hit(chunk_id="bad", score=0.1)

        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[good_hit, bad_hit],
        ):
            result = await search_ctdt_program_info.coroutine(
                query="Chuẩn đầu ra CNTT",
                program_name="CNTT",
            )

        data = json.loads(result)
        assert len(data["hits"]) == 1
        assert data["hits"][0]["score"] >= _MIN_SCORE_THRESHOLD

    @pytest.mark.asyncio
    async def test_retrieval_exception_returns_error(self) -> None:
        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            side_effect=RuntimeError("DB connection failed"),
        ):
            result = await search_ctdt_program_info.coroutine(
                query="Mục tiêu đào tạo",
                program_name="CNTT",
            )

        assert result.startswith("ERROR:")
        assert "Lỗi khi tìm kiếm CTĐT" in result


# ── 5. top_k clamping tests ───────────────────────────────────────────


class TestTopKClamp:
    """top_k is clamped to [1, 5]."""

    @pytest.mark.asyncio
    async def test_clamp_zero_to_one(self) -> None:
        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[_make_mock_hit()],
        ) as mock_search:
            await search_ctdt_program_info.coroutine(
                query="test", program_name="CNTT", top_k=0,
            )

        _, kwargs = mock_search.call_args
        assert kwargs["top_k"] == 1

    @pytest.mark.asyncio
    async def test_clamp_negative_to_one(self) -> None:
        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[_make_mock_hit()],
        ) as mock_search:
            await search_ctdt_program_info.coroutine(
                query="test", program_name="CNTT", top_k=-3,
            )

        _, kwargs = mock_search.call_args
        assert kwargs["top_k"] == 1

    @pytest.mark.asyncio
    async def test_clamp_ten_to_five(self) -> None:
        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[_make_mock_hit()],
        ) as mock_search:
            await search_ctdt_program_info.coroutine(
                query="test", program_name="CNTT", top_k=10,
            )

        _, kwargs = mock_search.call_args
        assert kwargs["top_k"] == 5

    @pytest.mark.asyncio
    async def test_valid_top_k_unchanged(self) -> None:
        with patch(
            "app.rag.ctdt_retrieval.search_ctdt_chunks",
            new_callable=AsyncMock,
            return_value=[_make_mock_hit()],
        ) as mock_search:
            await search_ctdt_program_info.coroutine(
                query="test", program_name="CNTT", top_k=3,
            )

        _, kwargs = mock_search.call_args
        assert kwargs["top_k"] == 3


# ── 6. Prompt / registry tests ────────────────────────────────────────


class TestToolRegistry:
    """search_ctdt_program_info is registered and visible in TOOLS."""

    def test_tool_in_tools_list(self) -> None:
        from app.agent.nodes import TOOLS

        tool_names = [t.name for t in TOOLS]
        assert "search_ctdt_program_info" in tool_names

    def test_base_tools_count(self) -> None:
        from app.agent.nodes import _BASE_TOOLS

        assert len(_BASE_TOOLS) == 5  # sql, clo, lookup, dropout, ctdt


class TestPromptCtdtPolicy:
    """Prompts contain CTĐT routing and citation mandate."""

    def test_router_prompt_routes_ctdt(self) -> None:
        from app.agent.prompts import ROUTER_SYSTEM_PROMPT

        assert "CTĐT" in ROUTER_SYSTEM_PROMPT
        assert "core_agent" in ROUTER_SYSTEM_PROMPT

    def test_router_prompt_has_ctdt_example(self) -> None:
        from app.agent.prompts import ROUTER_SYSTEM_PROMPT

        assert "Chuẩn đầu ra ngành CNTT" in ROUTER_SYSTEM_PROMPT

    def test_core_prompt_lists_ctdt_tool(self) -> None:
        from app.agent.prompts import CORE_AGENT_SYSTEM_PROMPT

        assert "search_ctdt_program_info" in CORE_AGENT_SYSTEM_PROMPT

    def test_core_prompt_requires_citation(self) -> None:
        from app.agent.prompts import CORE_AGENT_SYSTEM_PROMPT

        # Citation policy: must mention Nguồn (source) section
        assert "Nguồn" in CORE_AGENT_SYSTEM_PROMPT or "Nguon" in CORE_AGENT_SYSTEM_PROMPT

    def test_core_prompt_mentions_ctdt_mandatory(self) -> None:
        from app.agent.prompts import CORE_AGENT_SYSTEM_PROMPT

        assert "BẮT BUỘC" in CORE_AGENT_SYSTEM_PROMPT
        assert "search_ctdt_program_info" in CORE_AGENT_SYSTEM_PROMPT

    def test_constraints_list_ctdt_tool(self) -> None:
        from app.agent.prompts import CORE_AGENT_SYSTEM_PROMPT

        # The Constraints section must include the new tool name
        assert "search_ctdt_program_info" in CORE_AGENT_SYSTEM_PROMPT

    def test_prompt_versions_bumped(self) -> None:
        from app.agent.prompts import (
            CORE_AGENT_PROMPT_VERSION,
            ROUTER_PROMPT_VERSION,
        )

        assert ROUTER_PROMPT_VERSION == "2026-07-01.2"
        assert CORE_AGENT_PROMPT_VERSION == "2026-07-04.2"

    def test_prompt_manifest_checksums_valid(self) -> None:
        """Checksums should be 64-char hex and deterministic."""
        import re

        from app.agent.prompts import get_universal_agent_prompt_manifest

        manifest = get_universal_agent_prompt_manifest()
        hex_pattern = re.compile(r"^[0-9a-f]{64}$")
        for entry in manifest:
            assert hex_pattern.match(entry["checksum"]), (
                f"Bad checksum for {entry['name']}: {entry['checksum']}"
            )
