"""CTĐT vector retrieval over rag.ctdt_chunks (pgvector)."""

from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Any

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import get_settings

logger = logging.getLogger(__name__)


class CtdtRetrievalHit(BaseModel):
    chunk_id: str
    score: float
    content: str
    citation_label: str
    source_file: str
    page_start: int | None = None
    page_end: int | None = None
    section_title: str | None = None
    program_name: str
    program_code: str | None = None


def _embedding_api_key() -> str:
    settings = get_settings()
    if settings.llm_api_key.strip():
        return settings.llm_api_key.strip()
    if settings.openai_api_key.strip():
        return settings.openai_api_key.strip()
    raise RuntimeError("OPENAI_API_KEY or LLM_API_KEY required for embeddings")


def embed_query(text: str) -> list[float]:
    """Embed a single query using configured RAG embedding model."""
    settings = get_settings()
    from langchain_openai import OpenAIEmbeddings

    embeddings = OpenAIEmbeddings(
        model=settings.rag_embedding_model,
        api_key=_embedding_api_key(),
    )
    vector = embeddings.embed_query(text)
    if len(vector) != settings.rag_embedding_dimension:
        raise ValueError(
            f"Embedding dimension {len(vector)} != configured {settings.rag_embedding_dimension}"
        )
    return vector


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{v:.8f}" for v in values) + "]"


def _async_postgres_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


@lru_cache(maxsize=4)
def _rag_engine(url: str) -> AsyncEngine:
    return create_async_engine(
        _async_postgres_url(url),
        pool_pre_ping=True,
        pool_recycle=3600,
    )


async def search_ctdt_chunks(
    query: str,
    *,
    program_name: str | None = None,
    top_k: int = 5,
    db_url: str | None = None,
) -> list[CtdtRetrievalHit]:
    """Top-k cosine similarity search over indexed CTĐT chunks."""
    settings = get_settings()
    url = db_url or settings.agent_db_url
    query_vec = await asyncio.to_thread(embed_query, query)
    vec_literal = _vector_literal(query_vec)

    sql = """
        SELECT
            chunk_id,
            program_name,
            program_code,
            source_file,
            page_start,
            page_end,
            section_title,
            content,
            citation_label,
            1 - (embedding <=> CAST(:vec_literal AS vector)) AS score
        FROM rag.ctdt_chunks
        WHERE embedding IS NOT NULL
          AND (:program_name IS NULL OR program_name = :program_name)
        ORDER BY embedding <=> CAST(:vec_literal AS vector)
        LIMIT :top_k
    """

    async with _rag_engine(url).connect() as conn:
        result = await conn.execute(
            text(sql),
            {"vec_literal": vec_literal, "program_name": program_name, "top_k": top_k},
        )
        rows: list[dict[str, Any]] = [dict(row) for row in result.mappings().all()]

    hits: list[CtdtRetrievalHit] = []
    for row in rows:
        hits.append(
            CtdtRetrievalHit(
                chunk_id=row["chunk_id"],
                score=float(row["score"]),
                content=row["content"],
                citation_label=row["citation_label"],
                source_file=row["source_file"],
                page_start=row["page_start"],
                page_end=row["page_end"],
                section_title=row["section_title"],
                program_name=row["program_name"],
                program_code=row.get("program_code"),
            )
        )
    return hits
