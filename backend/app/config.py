"""Application settings loaded from environment variables (.env file)."""

from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralised config for EduInsight backend.

    All fields can be overridden via environment variables or a .env file.
    Async-compatible DB URLs are required:
      - Dev  : sqlite+aiosqlite:///./eduinsight.db
      - Prod : postgresql+asyncpg://user:pass@host:5432/eduinsight
    """

    # ------------------------------------------------------------------ app
    app_name: str = "EduInsight API"
    app_env: str = "development"  # development | staging | production
    app_version: str = "0.1.0"
    debug: bool = False

    # ---------------------------------------------------------------- database
    database_url: str = "sqlite+aiosqlite:///./eduinsight.db"

    # -------------------------------------------------------------------- auth
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    seed_password: str = "123456"  # Password for default seeded users

    # -------------------------------------------------------------------- cors
    cors_origins: str = "http://localhost:3000"

    # --------------------------------------------------------------------- llm
    llm_provider: str = "openai"  # gemini | mistral | openai
    llm_model: str = "gpt-4o"
    llm_api_key: str = ""
    # Standard provider env vars — used as fallback when llm_api_key is not set.
    openai_api_key: str = ""
    gemini_api_key: str = ""

    # ------------------------------------------------------------------- agent
    agent_router_model: str = "gpt-5.4-nano"
    agent_core_model: str = "gpt-5.4-nano"
    agent_db_url: str = "postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight"

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    @field_validator("debug", mode="before")
    @classmethod
    def _parse_debug(cls, value: object) -> object:
        """Accept common non-boolean DEBUG values from host shells."""
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production", "false", "0", "off", "no"}:
                return False
            if normalized in {"debug", "dev", "development", "true", "1", "on", "yes"}:
                return True
        return value

    @model_validator(mode="after")
    def _fallback_llm_api_key(self) -> "Settings":
        """Fall back to the provider's standard env var when LLM_API_KEY is empty.

        Lets the app pick up OPENAI_API_KEY / GEMINI_API_KEY without forcing the
        operator to duplicate the secret into LLM_API_KEY.
        """
        if not self.llm_api_key.strip():
            provider = self.llm_provider.lower().strip()
            if provider == "openai" and self.openai_api_key.strip():
                self.llm_api_key = self.openai_api_key.strip()
            elif provider == "gemini" and self.gemini_api_key.strip():
                self.llm_api_key = self.gemini_api_key.strip()
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a list."""
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def is_production(self) -> bool:
        """Return True when running in production environment."""
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings (singleton)."""
    return Settings()
