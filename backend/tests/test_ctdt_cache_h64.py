"""H64 — CTĐT retrieval cache tests.

Tests that:
- Same query/model/corpus_version hits cache (embed called once)
- Different program_name or top_k → cache miss
- Changed corpus_version → cache miss
"""

from unittest.mock import MagicMock, patch

import pytest

from app.rag.ctdt_retrieval import (
    CtdtRetrievalHit,
    _embedding_cache,
    _normalize_query,
    _retrieval_cache,
    _retrieval_cache_key,
    embed_query,
    get_corpus_version,
)


@pytest.fixture(autouse=True)
def _clear_caches():
    """Clear caches before each test."""
    _embedding_cache.clear()
    _retrieval_cache.clear()
    yield
    _embedding_cache.clear()
    _retrieval_cache.clear()


class TestNormalizeQuery:
    def test_lowercases(self):
        assert _normalize_query("Hello World") == "hello world"

    def test_strips_whitespace(self):
        assert _normalize_query("  hello   world  ") == "hello world"

    def test_unicode_normalization(self):
        # NFC normalization
        result = _normalize_query("Công nghệ")
        assert result == "công nghệ"


class TestEmbeddingCache:
    @patch("app.rag.ctdt_retrieval._embedding_api_key", return_value="test-key")
    def test_cache_hit_same_query(self, _mock_key):
        """Same query and model should hit cache on second call."""
        fake_vector = [0.1] * 1536

        with patch("app.rag.ctdt_retrieval.get_settings") as mock_settings:
            mock_settings.return_value.rag_embedding_model = "text-embedding-3-small"
            mock_settings.return_value.rag_embedding_dimension = 1536
            mock_settings.return_value.llm_api_key = "test"
            mock_settings.return_value.openai_api_key = "test"

            with patch("langchain_openai.OpenAIEmbeddings") as mock_emb:
                instance = MagicMock()
                instance.embed_query.return_value = fake_vector
                mock_emb.return_value = instance

                # First call — should call embed
                result1 = embed_query("ngành CNTT")
                assert instance.embed_query.call_count == 1
                assert result1 == fake_vector

                # Second call — should hit cache
                result2 = embed_query("ngành CNTT")
                assert instance.embed_query.call_count == 1  # Not called again
                assert result2 == fake_vector

    @patch("app.rag.ctdt_retrieval._embedding_api_key", return_value="test-key")
    def test_cache_miss_different_query(self, _mock_key):
        """Different queries should produce cache misses."""
        fake_vector = [0.1] * 1536

        with patch("app.rag.ctdt_retrieval.get_settings") as mock_settings:
            mock_settings.return_value.rag_embedding_model = "text-embedding-3-small"
            mock_settings.return_value.rag_embedding_dimension = 1536
            mock_settings.return_value.llm_api_key = "test"
            mock_settings.return_value.openai_api_key = "test"

            with patch("langchain_openai.OpenAIEmbeddings") as mock_emb:
                instance = MagicMock()
                instance.embed_query.return_value = fake_vector
                mock_emb.return_value = instance

                embed_query("ngành CNTT")
                embed_query("ngành QTKD")
                assert instance.embed_query.call_count == 2


class TestRetrievalCacheKey:
    def test_same_params_same_key(self):
        k1 = _retrieval_cache_key("v1", "CNTT", 5, "query", "model-a")
        k2 = _retrieval_cache_key("v1", "CNTT", 5, "query", "model-a")
        assert k1 == k2

    def test_different_program_different_key(self):
        k1 = _retrieval_cache_key("v1", "CNTT", 5, "query", "model-a")
        k2 = _retrieval_cache_key("v1", "QTKD", 5, "query", "model-a")
        assert k1 != k2

    def test_different_top_k_different_key(self):
        k1 = _retrieval_cache_key("v1", "CNTT", 5, "query", "model-a")
        k2 = _retrieval_cache_key("v1", "CNTT", 10, "query", "model-a")
        assert k1 != k2

    def test_different_corpus_version_different_key(self):
        """H64: changing corpus version invalidates cache."""
        k1 = _retrieval_cache_key("100:2026-01-01", "CNTT", 5, "query", "model-a")
        k2 = _retrieval_cache_key("101:2026-01-02", "CNTT", 5, "query", "model-a")
        assert k1 != k2

    def test_different_model_different_key(self):
        k1 = _retrieval_cache_key("v1", "CNTT", 5, "query", "model-a")
        k2 = _retrieval_cache_key("v1", "CNTT", 5, "query", "model-b")
        assert k1 != k2


class TestGetCorpusVersion:
    @patch("psycopg2.connect")
    def test_returns_count_and_timestamp(self, mock_connect):
        from datetime import datetime

        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (42, datetime(2026, 7, 1, 12, 0))
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_connect.return_value = mock_conn

        version = get_corpus_version("postgresql://test")
        assert version.startswith("42:")

    @patch("psycopg2.connect", side_effect=Exception("connection failed"))
    def test_returns_unknown_on_failure(self, mock_connect):
        version = get_corpus_version("postgresql://test")
        assert version == "unknown"


class TestRetrievalCacheIntegration:
    """Verify that retrieval cache stores and returns results correctly."""

    def test_cache_stores_hits(self):
        """Manually put a result in cache and verify retrieval."""
        key = _retrieval_cache_key("v1", "CNTT", 5, "test query", "model-a")
        hits = [
            CtdtRetrievalHit(
                chunk_id="test-001",
                score=0.95,
                content="Test content",
                citation_label="Test citation",
                source_file="test.pdf",
                program_name="CNTT",
            )
        ]
        _retrieval_cache[key] = hits

        cached = _retrieval_cache.get(key)
        assert cached is not None
        assert len(cached) == 1
        assert cached[0].chunk_id == "test-001"

    def test_cache_miss_on_version_change(self):
        """Different corpus version → no cache hit."""
        key_v1 = _retrieval_cache_key("v1", "CNTT", 5, "test", "model")
        _retrieval_cache[key_v1] = []

        key_v2 = _retrieval_cache_key("v2", "CNTT", 5, "test", "model")
        assert _retrieval_cache.get(key_v2) is None
