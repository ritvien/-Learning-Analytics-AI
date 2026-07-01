"""add rag ctdt schema with pgvector

Revision ID: 9f2b7c6d4a10
Revises: f3a4b5c6d7e8
Create Date: 2026-07-01
"""

from collections.abc import Sequence

from alembic import op

revision: str = "9f2b7c6d4a10"
down_revision: str | Sequence[str] | None = "f3a4b5c6d7e8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE SCHEMA IF NOT EXISTS rag")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS rag.ctdt_documents (
            document_id     TEXT PRIMARY KEY,
            source_file     TEXT NOT NULL,
            program_name    TEXT NOT NULL,
            program_code    TEXT,
            sha256          TEXT NOT NULL,
            page_count      INT,
            status          TEXT NOT NULL DEFAULT 'indexed',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS rag.ctdt_chunks (
            chunk_id        TEXT PRIMARY KEY,
            document_id     TEXT NOT NULL REFERENCES rag.ctdt_documents(document_id) ON DELETE CASCADE,
            program_name    TEXT NOT NULL,
            program_code    TEXT,
            source_file     TEXT NOT NULL,
            page_start      INT,
            page_end        INT,
            section_title   TEXT,
            content         TEXT NOT NULL,
            content_sha256  TEXT NOT NULL,
            token_count     INT,
            citation_label  TEXT NOT NULL,
            embedding_model TEXT,
            embedded_at     TIMESTAMPTZ,
            embedding       vector(1536),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (document_id, content_sha256)
        )
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS ix_ctdt_chunks_program ON rag.ctdt_chunks (program_name)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ctdt_chunks_document ON rag.ctdt_chunks (document_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ctdt_chunks_page ON rag.ctdt_chunks (page_start)")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_ctdt_chunks_embedding
        ON rag.ctdt_chunks USING hnsw (embedding vector_cosine_ops)
        """
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    op.execute("DROP INDEX IF EXISTS rag.ix_ctdt_chunks_embedding")
    op.execute("DROP INDEX IF EXISTS rag.ix_ctdt_chunks_page")
    op.execute("DROP INDEX IF EXISTS rag.ix_ctdt_chunks_document")
    op.execute("DROP INDEX IF EXISTS rag.ix_ctdt_chunks_program")
    op.execute("DROP TABLE IF EXISTS rag.ctdt_chunks")
    op.execute("DROP TABLE IF EXISTS rag.ctdt_documents")
    op.execute("DROP SCHEMA IF EXISTS rag")
