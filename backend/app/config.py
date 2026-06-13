"""Application settings loaded from environment variables (.env file)."""

from functools import lru_cache

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

    # -------------------------------------------------------------------- cors
    cors_origins: str = "http://localhost:3000"

    # --------------------------------------------------------------------- llm
    llm_provider: str = "gemini"  # gemini | mistral | openai
    llm_model: str = "gemini-1.5-flash"
    llm_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

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
