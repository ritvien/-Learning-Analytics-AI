#!/usr/bin/env python3
"""Idempotent ingest of CTĐT chunks into rag.ctdt_* tables with embeddings."""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import get_settings
from app.rag.ctdt_corpus import load_jsonl
from app.rag.ctdt_retrieval import _embedding_api_key, _vector_literal


def embed_texts(texts: list[str], model: str) -> list[list[float]]:
    from langchain_openai import OpenAIEmbeddings

    embeddings = OpenAIEmbeddings(model=model, api_key=_embedding_api_key())
    return embeddings.embed_documents(texts)


def upsert_document(cur, row: dict, sha256: str, page_count: int | None) -> None:
    cur.execute(
        """
        INSERT INTO rag.ctdt_documents (
            document_id, source_file, program_name, program_code, sha256, page_count, status
        ) VALUES (%s, %s, %s, %s, %s, %s, 'indexed')
        ON CONFLICT (document_id) DO UPDATE SET
            source_file = EXCLUDED.source_file,
            program_name = EXCLUDED.program_name,
            program_code = EXCLUDED.program_code,
            sha256 = EXCLUDED.sha256,
            page_count = EXCLUDED.page_count,
            updated_at = NOW()
        """,
        (
            row["document_id"],
            row["source_file"],
            row["program_name"],
            row.get("program_code"),
            sha256,
            page_count,
        ),
    )


def ingest_chunks(
    *,
    input_path: Path,
    dry_run: bool,
    limit: int | None,
    program_filter: str | None,
    force_reembed: bool,
    db_url: str,
) -> dict[str, int]:
    settings = get_settings()
    rows = load_jsonl(input_path)
    if program_filter and program_filter.lower() != "all":
        if program_filter.lower() == "mvp":
            mvp_names = {
                "Công nghệ thông tin",
                "Khoa học dữ liệu",
                "Trí tuệ nhân tạo",
            }
            rows = [r for r in rows if r["program_name"] in mvp_names]
        else:
            rows = [r for r in rows if r["program_name"].lower() == program_filter.lower()]
    if limit is not None:
        rows = rows[:limit]

    stats = {"documents": 0, "chunks_upserted": 0, "chunks_embedded": 0, "chunks_skipped": 0}

    if dry_run:
        stats["chunks_upserted"] = len(rows)
        print(f"Dry-run: would ingest {len(rows)} chunks")
        return stats

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            doc_ids: set[str] = set()
            pending_embed: list[dict] = []

            for row in rows:
                doc_ids.add(row["document_id"])
                page_end = row.get("page_end")
                upsert_document(
                    cur,
                    row,
                    sha256=row["content_sha256"],
                    page_count=int(page_end) if page_end is not None else None,
                )

                existing = None
                cur.execute(
                    """
                    SELECT content_sha256, embedding_model, embedding IS NOT NULL AS has_embedding
                    FROM rag.ctdt_chunks WHERE chunk_id = %s
                    """,
                    (row["chunk_id"],),
                )
                existing = cur.fetchone()

                needs_embed = force_reembed
                if existing is None:
                    needs_embed = True
                elif existing["content_sha256"] != row["content_sha256"]:
                    needs_embed = True
                elif existing["embedding_model"] != settings.rag_embedding_model:
                    needs_embed = True
                elif not existing["has_embedding"]:
                    needs_embed = True

                cur.execute(
                    """
                    INSERT INTO rag.ctdt_chunks (
                        chunk_id, document_id, program_name, program_code, source_file,
                        page_start, page_end, section_title, content, content_sha256,
                        token_count, citation_label, embedding_model, embedded_at, embedding
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, NULL, NULL, NULL
                    )
                    ON CONFLICT (chunk_id) DO UPDATE SET
                        document_id = EXCLUDED.document_id,
                        program_name = EXCLUDED.program_name,
                        program_code = EXCLUDED.program_code,
                        source_file = EXCLUDED.source_file,
                        page_start = EXCLUDED.page_start,
                        page_end = EXCLUDED.page_end,
                        section_title = EXCLUDED.section_title,
                        content = EXCLUDED.content,
                        content_sha256 = EXCLUDED.content_sha256,
                        token_count = EXCLUDED.token_count,
                        citation_label = EXCLUDED.citation_label,
                        updated_at = NOW()
                    """,
                    (
                        row["chunk_id"],
                        row["document_id"],
                        row["program_name"],
                        row.get("program_code"),
                        row["source_file"],
                        row.get("page_start"),
                        row.get("page_end"),
                        row.get("section_title"),
                        row["content"],
                        row["content_sha256"],
                        row.get("token_count"),
                        row["citation_label"],
                    ),
                )
                stats["chunks_upserted"] += 1

                if needs_embed:
                    pending_embed.append(row)
                else:
                    stats["chunks_skipped"] += 1

            stats["documents"] = len(doc_ids)

            batch_size = 32
            for i in range(0, len(pending_embed), batch_size):
                batch = pending_embed[i : i + batch_size]
                vectors = embed_texts([r["content"] for r in batch], settings.rag_embedding_model)
                now = datetime.now(UTC)
                for row, vector in zip(batch, vectors, strict=True):
                    cur.execute(
                        """
                        UPDATE rag.ctdt_chunks
                        SET embedding = %s::vector,
                            embedding_model = %s,
                            embedded_at = %s,
                            updated_at = NOW()
                        WHERE chunk_id = %s
                        """,
                        (
                            _vector_literal(vector),
                            settings.rag_embedding_model,
                            now,
                            row["chunk_id"],
                        ),
                    )
                    stats["chunks_embedded"] += 1

        conn.commit()
    finally:
        conn.close()

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest CTĐT RAG chunks into pgvector.")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path("../docs/20-RAG-Corpus-Preparation/ctdt/ctdt_chunks.jsonl"),
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--program", type=str, default="all")
    parser.add_argument("--force-reembed", action="store_true")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Input not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    settings = get_settings()
    stats = ingest_chunks(
        input_path=args.input,
        dry_run=args.dry_run,
        limit=args.limit,
        program_filter=args.program,
        force_reembed=args.force_reembed,
        db_url=settings.agent_db_url,
    )
    print(stats)


if __name__ == "__main__":
    main()
