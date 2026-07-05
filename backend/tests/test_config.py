"""Settings behavior for pytest and CI."""

import pytest

from app.config import get_settings


def test_settings_block_llm_key_fallback_when_app_env_is_test(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-should-not-propagate")
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.llm_api_key == ""
    assert settings.openai_api_key == ""
    assert settings.gemini_api_key == ""


@pytest.mark.parametrize(
    ("raw_url", "expected"),
    [
        (
            "postgresql://user:pass@host:5432/eduinsight",
            "postgresql+asyncpg://user:pass@host:5432/eduinsight",
        ),
        (
            "postgres://user:pass@host:5432/eduinsight",
            "postgresql+asyncpg://user:pass@host:5432/eduinsight",
        ),
        (
            "postgresql+asyncpg://user:pass@host:5432/eduinsight",
            "postgresql+asyncpg://user:pass@host:5432/eduinsight",
        ),
        ("sqlite+aiosqlite:///./eduinsight.db", "sqlite+aiosqlite:///./eduinsight.db"),
    ],
)
def test_database_url_normalized_to_asyncpg(
    monkeypatch: pytest.MonkeyPatch, raw_url: str, expected: str
) -> None:
    """Render blueprint injects postgresql:// — Settings must force asyncpg."""
    monkeypatch.setenv("DATABASE_URL", raw_url)
    get_settings.cache_clear()

    assert get_settings().database_url == expected

    get_settings.cache_clear()
