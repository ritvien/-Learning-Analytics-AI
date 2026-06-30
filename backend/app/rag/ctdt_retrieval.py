"""CTĐT vector retrieval over rag.ctdt_chunks (pgvector)."""

from __future__ import annotations

import logging
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel

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
    query_vec = embed_query(query)
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
            1 - (embedding <=> %s::vector) AS score
        FROM rag.ctdt_chunks
        WHERE embedding IS NOT NULL
          AND (%s IS NULL OR program_name = %s)
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """

    conn = psycopg2.connect(url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (vec_literal, program_name, program_name, vec_literal, top_k))
            rows: list[dict[str, Any]] = cur.fetchall()
    finally:
        conn.close()

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
