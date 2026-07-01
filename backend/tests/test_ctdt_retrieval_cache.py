from __future__ import annotations

import pytest

from app.rag import ctdt_retrieval


class _FakeEngine:
    def __init__(self, url: str) -> None:
        self.url = url
        self.disposed = False

    async def dispose(self) -> None:
        self.disposed = True


@pytest.mark.asyncio
async def test_rag_engine_disposes_evicted_pool(monkeypatch: pytest.MonkeyPatch):
    created: list[_FakeEngine] = []

    def fake_create_async_engine(url: str, **_kwargs: object) -> _FakeEngine:
        engine = _FakeEngine(url)
        created.append(engine)
        return engine

    ctdt_retrieval._RAG_ENGINES.clear()
    monkeypatch.setattr(ctdt_retrieval, "create_async_engine", fake_create_async_engine)

    try:
        for index in range(ctdt_retrieval._RAG_ENGINE_CACHE_SIZE + 1):
            await ctdt_retrieval._rag_engine(f"postgresql://user:pass@localhost:5433/db{index}")

        assert created[0].disposed is True
        assert all(engine.disposed is False for engine in created[1:])
        assert len(ctdt_retrieval._RAG_ENGINES) == ctdt_retrieval._RAG_ENGINE_CACHE_SIZE
    finally:
        ctdt_retrieval._RAG_ENGINES.clear()
