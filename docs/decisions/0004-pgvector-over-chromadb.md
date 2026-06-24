# ADR-004: pgvector on PostgreSQL over ChromaDB

**Status:** accepted · **Date:** 2026-06

## Context

RAG requires vector search alongside relational analytics. Operating a separate vector database increases deployment complexity.

## Decision

Use **pgvector** on the existing PostgreSQL instance instead of a standalone ChromaDB.

## Consequences

- Single database to operate in MVP
- Hybrid search: SQL filters + vector similarity
- Embeddings live in PostgreSQL, separate from ML prediction tables in schema `ml`
