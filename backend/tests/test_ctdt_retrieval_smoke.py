"""Integration smoke tests for CTĐT pgvector retrieval."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

SMOKE_QUERIES = Path(__file__).resolve().parents[2] / "docs" / "20-RAG-Corpus-Preparation" / "ctdt" / "smoke-queries.json"

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.environ.get("GITHUB_ACTIONS") == "true",
        reason="pgvector + embeddings smoke — run locally only",
    ),
]


@pytest.fixture(autouse=True)
def _refresh_settings() -> None:
    from dotenv import load_dotenv

    from app.config import get_settings

    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_ctdt_retrieval_smoke_queries() -> None:
    from app.config import get_settings
    from app.rag.ctdt_retrieval import search_ctdt_chunks

    settings = get_settings()
    if not (settings.llm_api_key.strip() or settings.openai_api_key.strip()):
        pytest.skip("OPENAI_API_KEY or LLM_API_KEY required")

    queries = json.loads(SMOKE_QUERIES.read_text(encoding="utf-8"))["queries"]
    for item in queries[:3]:
        hits = await search_ctdt_chunks(
            item["query"],
            program_name=item.get("program_name"),
            top_k=3,
        )
        assert len(hits) >= item.get("min_hits", 1)
        assert hits[0].score > 0.2
        assert item["program_name"] in hits[0].citation_label or item["program_name"] in hits[0].content


@pytest.mark.asyncio
async def test_ctdt_retrieval_plan_queries() -> None:
    from app.config import get_settings
    from app.rag.ctdt_retrieval import search_ctdt_chunks

    settings = get_settings()
    if not (settings.llm_api_key.strip() or settings.openai_api_key.strip()):
        pytest.skip("OPENAI_API_KEY or LLM_API_KEY required")

    plan_queries = [
        "Chuẩn đầu ra ngành Công nghệ thông tin là gì?",
        "Ngành Trí tuệ nhân tạo có các khối kiến thức nào?",
        "Mục tiêu đào tạo ngành Khoa học dữ liệu?",
    ]
    for query in plan_queries:
        hits = await search_ctdt_chunks(query, top_k=3)
        assert hits, f"No hits for: {query}"
        assert hits[0].citation_label
