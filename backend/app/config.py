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
    llm_provider: str = "openai"  # gemini | openai-compatible providers, including DeepSeek
    llm_model: str = "deepseek-chat"
    llm_api_key: str = ""
    llm_base_url: str = ""  # override API base, e.g. https://api.deepseek.com/v1
    # Standard provider env vars — used as fallback when llm_api_key is not set.
    openai_api_key: str = ""
    gemini_api_key: str = ""

    # ------------------------------------------------------------------- agent
    agent_router_model: str = "deepseek-chat"
    agent_core_model: str = "deepseek-chat"
    chat_title_model: str = "deepseek-chat"
    agent_db_url: str = "postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight"

    # ---------------------------------------------------------------------- ml
    # Writable in Docker (non-root app user); override via ML_ARTIFACT_DIR.
    ml_artifact_dir: str = "/tmp/ml_artifacts"

    # -------------------------------------------------------------------- mail
    smtp_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = "EduInsight"
    smtp_use_tls: bool = True
    smtp_timeout_seconds: int = 15

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
        default_model = self.llm_model.strip()
        if default_model:
            if not self.agent_router_model.strip():
                self.agent_router_model = default_model
            if not self.agent_core_model.strip():
                self.agent_core_model = default_model
            if not self.chat_title_model.strip():
                self.chat_title_model = default_model
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
