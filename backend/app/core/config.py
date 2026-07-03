from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Конфигурация приложения. Значения берутся из переменных окружения / .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    database_url: str = ""
    secret_key: str = "arkand-dev-secret-change-me"
    access_token_expire_minutes: int = 10080  # 7 дней
    cors_origins: str = "*"
    seed_on_startup: bool = True
    app_name: str = "Arkand · Застройщик"

    @property
    def sqlalchemy_url(self) -> str:
        """Приводит DATABASE_URL к async-драйверу.

        - Пусто -> локальный SQLite (aiosqlite), проект запускается без внешней БД.
        - postgres:// или postgresql:// (Railway) -> postgresql+asyncpg://
        """
        url = (self.database_url or "").strip()
        if not url:
            return "sqlite+aiosqlite:///./arkand.db"
        if url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://"):]
        # Убираем несовместимый с asyncpg параметр sslmode из query, если он есть.
        if "+asyncpg" in url and "sslmode=" in url:
            from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

            parts = urlsplit(url)
            query = [(k, v) for k, v in parse_qsl(parts.query) if k != "sslmode"]
            url = urlunsplit(parts._replace(query=urlencode(query)))
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        raw = (self.cors_origins or "*").strip()
        if raw == "*" or raw == "":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.sqlalchemy_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
