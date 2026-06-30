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
