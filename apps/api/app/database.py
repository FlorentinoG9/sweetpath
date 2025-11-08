"""Database configuration for the Candy Map API."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .config import settings


def _build_engine() -> tuple[str, dict[str, bool]]:
    if settings.database_url.startswith("sqlite"):
        return settings.database_url, {"check_same_thread": False}
    return settings.database_url, {}


DATABASE_URL, CONNECT_ARGS = _build_engine()

engine = create_engine(
    DATABASE_URL,
    connect_args=CONNECT_ARGS,
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


