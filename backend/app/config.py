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
    seed_password: str = "password123"  # Used only when a default demo user is first created

    # -------------------------------------------------------------------- cors
    cors_origins: str = "http://localhost:3000"

    # --------------------------------------------------------------------- llm
    llm_provider: str = "openai"  # gemini | openai-compatible providers, including DeepSeek
    llm_model: str = "gpt-5.4-nano"
    llm_api_key: str = ""
    llm_base_url: str = ""  # override API base, e.g. https://api.deepseek.com/v1
    # Standard provider env vars — used as fallback when llm_api_key is not set.
    openai_api_key: str = ""
    gemini_api_key: str = ""

    # ------------------------------------------------------------------- agent
    agent_router_model: str = "gpt-5.4-nano"
    agent_core_model: str = "gpt-5.4-nano"
    chat_title_model: str = "gpt-5.4-nano"
    agent_db_url: str = "postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight"
    # H67: in-process backpressure (ADR-0011). Limits apply per worker process.
    max_concurrent_agent_runs: int = 3
    agent_run_timeout_seconds: int = 120

    # --------------------------------------------------------------- dashboards
    # DWH-backed dashboard payloads only change via admin refresh/imports (which
    # clear the cache explicitly), so the TTL is a safety net, not freshness.
    dashboard_cache_ttl_seconds: int = 21600  # 6 hours
    # Background worker that keeps the default dashboards + academic tree warm
    # so no user request ever pays the cold aggregation. 0 disables the worker.
    dashboard_prewarm_interval_seconds: int = 300
    # Academic tree reads OLTP tables directly; keep its staleness window short.
    tree_cache_ttl_seconds: int = 900

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

    # --------------------------------------------------------------- langsmith
    langsmith_tracing: str = ""  # "true" to enable
    langsmith_api_key: str = ""
    langsmith_project: str = "eduinsight-s4-demo"
    langsmith_endpoint: str = ""  # optional override

    # --------------------------------------------------------------------- rag
    rag_embedding_model: str = "text-embedding-3-small"
    rag_embedding_dimension: int = 1536

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore")

    @field_validator("database_url", mode="before")
    @classmethod
    def _force_async_postgres_driver(cls, value: object) -> object:
        """Rewrite plain postgres schemes to asyncpg.

        Render/Heroku connection strings use postgresql:// (psycopg2), but the
        app and Alembic both need the async driver. Normalizing here removes
        the manual "edit DATABASE_URL in the dashboard" step that blueprint
        re-syncs kept reverting.
        """
        if isinstance(value, str):
            url = value.strip()
            if url.startswith("postgres://"):
                return "postgresql+asyncpg://" + url.removeprefix("postgres://")
            if url.startswith("postgresql://"):
                return "postgresql+asyncpg://" + url.removeprefix("postgresql://")
        return value

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
        if self.app_env.strip().lower() in {"test", "testing"}:
            # Pytest/CI must never call live LLMs — block .env/host key fallback.
            self.llm_api_key = ""
            self.openai_api_key = ""
            self.gemini_api_key = ""
            return self
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

    @property
    def langsmith_enabled(self) -> bool:
        """Return True when LangSmith tracing is configured and enabled."""
        return (
            self.langsmith_tracing.strip().lower() == "true"
            and bool(self.langsmith_api_key.strip())
        )


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings (singleton)."""
    return Settings()
