"""Database configuration for the Candy Map API."""

from collections.abc import Generator
from typing import Any

import libsql  # type: ignore[import]
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from .config import settings


def _build_engine_config() -> dict[str, Any]:
    if settings.database_url.startswith("libsql://"):
        if not settings.database_auth_token:
            raise RuntimeError(
                "Turso auth token missing. Set `CANDY_MAP_DATABASE_AUTH_TOKEN` in your environment."
            )

        class LibsqlConnectionProxy:
            def __init__(self, connection: Any) -> None:
                self._connection = connection

            def __getattr__(self, attribute: str) -> Any:
                return getattr(self._connection, attribute)

            def create_function(self, *_: Any, **__: Any) -> None:
                return None

        def create_libsql_connection() -> Any:
            connection = libsql.connect(
                settings.database_url,
                auth_token=settings.database_auth_token,
            )

            if hasattr(connection, "create_function"):
                return connection

            return LibsqlConnectionProxy(connection)

        return {
            "url": "sqlite://",
            "creator": create_libsql_connection,
            "poolclass": NullPool,
        }

    if settings.database_url.startswith("sqlite"):
        return {
            "url": settings.database_url,
            "connect_args": {"check_same_thread": False},
        }

    return {"url": settings.database_url}


ENGINE_CONFIG = _build_engine_config()

DATABASE_URL = ENGINE_CONFIG.pop("url")

engine = create_engine(
    DATABASE_URL,
    **ENGINE_CONFIG,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Provide a SQLAlchemy session for request-scoped usage."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

