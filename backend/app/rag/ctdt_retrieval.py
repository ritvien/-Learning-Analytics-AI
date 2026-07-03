"""CTDT vector retrieval over rag.ctdt_chunks (pgvector).

H64: in-process cachetools TTLCache for embedding and retrieval results.
Cache invalidation is automatic via corpus_version in cache key.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import unicodedata
from collections import OrderedDict
from typing import Any

import psycopg2
from cachetools import TTLCache
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.config import get_settings

logger = logging.getLogger(__name__)

# H64: cache configuration
_CACHE_MAXSIZE = 512
_CACHE_TTL = 86400  # 24 hours in seconds

_embedding_cache: TTLCache[str, list[float]] = TTLCache(
    maxsize=_CACHE_MAXSIZE,
    ttl=_CACHE_TTL,
)
_retrieval_cache: TTLCache[str, list[CtdtRetrievalHit]] = TTLCache(
    maxsize=_CACHE_MAXSIZE,
    ttl=_CACHE_TTL,
)
_cache_lock = threading.Lock()

_RAG_ENGINE_CACHE_SIZE = 4
_RAG_ENGINES: OrderedDict[str, AsyncEngine] = OrderedDict()
_RAG_ENGINE_LOCK = asyncio.Lock()


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


def _normalize_query(text: str) -> str:
    """Normalize query text for consistent cache keys."""
    text = unicodedata.normalize("NFC", text.strip().lower())
    return " ".join(text.split())


def embed_query(text: str) -> list[float]:
    """Embed a single query using configured RAG embedding model.

    H64: Results are cached by (model, normalized_query).
    """
    settings = get_settings()
    normalized = _normalize_query(text)
    cache_key = f"{settings.rag_embedding_model}:{normalized}"

    with _cache_lock:
        cached = _embedding_cache.get(cache_key)
        if cached is not None:
            logger.debug("H64: embedding cache hit for %s", cache_key[:60])
            return cached

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

    with _cache_lock:
        _embedding_cache[cache_key] = vector
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


async def _rag_engine(url: str) -> AsyncEngine:
    evicted: AsyncEngine | None = None
    async with _RAG_ENGINE_LOCK:
        engine = _RAG_ENGINES.get(url)
        if engine is not None:
            _RAG_ENGINES.move_to_end(url)
            return engine
        engine = create_async_engine(
            _async_postgres_url(url),
            pool_pre_ping=True,
            pool_recycle=3600,
        )
        _RAG_ENGINES[url] = engine
        if len(_RAG_ENGINES) > _RAG_ENGINE_CACHE_SIZE:
            _, evicted = _RAG_ENGINES.popitem(last=False)
    if evicted is not None:
        await evicted.dispose()
    return engine


def get_corpus_version(db_url: str | None = None) -> str:
    """Get corpus version from DB for cache invalidation.

    Returns ``"{count}:{max_updated_at_iso}"`` or ``"unknown"`` on failure.
    """
    settings = get_settings()
    url = db_url or settings.agent_db_url
    try:
        conn = psycopg2.connect(url)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*), MAX(updated_at) FROM rag.ctdt_chunks")
                row = cur.fetchone()
                if row and row[0]:
                    count = row[0]
                    max_updated = row[1].isoformat() if row[1] else "none"
                    return f"{count}:{max_updated}"
        finally:
            conn.close()
    except Exception:
        logger.debug("H64: corpus version query failed, using 'unknown'")
    return "unknown"


def _retrieval_cache_key(
    corpus_version: str,
    program_name: str | None,
    top_k: int,
    normalized_query: str,
    model: str,
) -> str:
    return f"{corpus_version}|{program_name}|{top_k}|{model}|{normalized_query}"


async def search_ctdt_chunks(
    query: str,
    *,
    program_name: str | None = None,
    top_k: int = 5,
    db_url: str | None = None,
) -> list[CtdtRetrievalHit]:
    """Top-k cosine similarity search over indexed CTDT chunks.

    H64: Results are cached by (corpus_version, program_name, top_k,
    model, normalized_query). Cache auto-invalidates when corpus changes.
    """
    settings = get_settings()
    url = db_url or settings.agent_db_url
    normalized = _normalize_query(query)
    corpus_version = await asyncio.to_thread(get_corpus_version, url)
    cache_key = _retrieval_cache_key(
        corpus_version,
        program_name,
        top_k,
        normalized,
        settings.rag_embedding_model,
    )
    with _cache_lock:
        cached = _retrieval_cache.get(cache_key)
        if cached is not None:
            logger.debug("H64: retrieval cache hit for %s", cache_key[:80])
            return cached

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

    async with (await _rag_engine(url)).connect() as conn:
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

    with _cache_lock:
        _retrieval_cache[cache_key] = hits

    return hits
