"""Shared pytest fixtures."""

from collections.abc import Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ..database import Base
from ..dependencies import get_geocoder
from ..main import app
from ..services.geocoding import GeocodeResult


class StubGeocoder:
    """Deterministic geocoder for tests."""

    def __init__(self) -> None:
        self.requests: list[dict[str, Any]] = []
        self.result = GeocodeResult(latitude=40.0, longitude=-74.0)

    def geocode(
        self,
        *,
        address_line1: str,
        address_line2: str | None,
        city: str,
        state: str,
        postal_code: str,
    ) -> GeocodeResult:
        self.requests.append(
            {
                "address_line1": address_line1,
                "address_line2": address_line2,
                "city": city,
                "state": state,
                "postal_code": postal_code,
            }
        )
        return self.result


@pytest.fixture()
def test_session() -> Generator[Session, None, None]:
    """Provide a transaction-scoped database session."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)
    try:
        db = TestingSessionLocal()
        yield db
        db.rollback()
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def stub_geocoder() -> StubGeocoder:
    """Return a stub geocoder instance."""
    return StubGeocoder()


@pytest.fixture()
def client(
    test_session: Session,
    stub_geocoder: StubGeocoder,
) -> Generator[TestClient, None, None]:
    """Provide a FastAPI test client with overrides."""

    def override_get_db() -> Generator[Session, None, None]:
        try:
            yield test_session
        finally:
            test_session.rollback()

    app.dependency_overrides[get_geocoder] = lambda: stub_geocoder
    from ..database import get_db

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


