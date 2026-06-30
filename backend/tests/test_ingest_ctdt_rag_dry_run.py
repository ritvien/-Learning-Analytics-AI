"""Dry-run tests for CTĐT RAG ingest script."""

from __future__ import annotations

from pathlib import Path

from scripts.ingest_ctdt_rag import ingest_chunks

ARTIFACT = Path(__file__).resolve().parents[2] / "docs" / "20-RAG-Corpus-Preparation" / "ctdt" / "ctdt_chunks.jsonl"


def test_ingest_dry_run_counts_chunks() -> None:
    stats = ingest_chunks(
        input_path=ARTIFACT,
        dry_run=True,
        limit=None,
        program_filter="all",
        force_reembed=False,
        db_url="postgresql://unused/unused",
    )
    assert stats["chunks_upserted"] >= 12


def test_ingest_dry_run_mvp_filter() -> None:
    stats = ingest_chunks(
        input_path=ARTIFACT,
        dry_run=True,
        limit=None,
        program_filter="mvp",
        force_reembed=False,
        db_url="postgresql://unused/unused",
    )
    assert stats["chunks_upserted"] >= 12
