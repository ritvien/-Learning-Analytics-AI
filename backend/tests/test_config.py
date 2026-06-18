"""Unit tests for config."""

import os
from unittest.mock import patch

from app.config import Settings


def test_settings_loads_defaults():
    """Settings loads with defaults without .env."""
    with patch.dict(os.environ, clear=True):
        settings = Settings(_env_file=None)
        assert settings.app_name == "EduInsight API"
        assert settings.app_env == "development"
        assert settings.is_production is False


def test_cors_origins_parsing():
    """CORS origins are correctly parsed as a list."""
    with patch.dict(os.environ, {"CORS_ORIGINS": "http://localhost:3000, https://example.com "}, clear=True):
        settings = Settings(_env_file=None)
        assert settings.cors_origins_list == ["http://localhost:3000", "https://example.com"]
