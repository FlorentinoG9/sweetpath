"""Integration tests for house CRUD endpoints."""

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from ..services.geocoding import GeocodeResult
from .conftest import StubGeocoder


def build_payload() -> dict[str, object]:
    return {
        "name": "The Spooky Manor",
        "address_line1": "123 Main St",
        "address_line2": None,
        "city": "Townsville",
        "state": "NY",
        "postal_code": "12345",
        "treats_description": "Full-size candy bars",
        "start_time": "17:30:00",
        "end_time": "21:00:00",
        "is_active": True,
    }


def test_create_house_uses_geocoder(
    client: TestClient,
    stub_geocoder: StubGeocoder,
) -> None:
    response = client.post("/houses", json=build_payload())
    assert response.status_code == status.HTTP_201_CREATED

    payload = response.json()
    assert payload["name"] == "The Spooky Manor"
    assert payload["latitude"] == stub_geocoder.result.latitude
    assert payload["longitude"] == stub_geocoder.result.longitude
    assert len(stub_geocoder.requests) == 1


def test_list_houses_returns_created_records(
    client: TestClient,
) -> None:
    client.post("/houses", json=build_payload())
    response = client.get("/houses")
    assert response.status_code == status.HTTP_200_OK
    houses = response.json()
    assert len(houses) == 1
    assert houses[0]["name"] == "The Spooky Manor"


def test_update_house_refreshes_coordinates_when_address_changes(
    client: TestClient,
    stub_geocoder: StubGeocoder,
) -> None:
    create_response = client.post("/houses", json=build_payload())
    house_id = create_response.json()["id"]

    stub_geocoder.result = GeocodeResult(latitude=41.0, longitude=-75.0)

    response = client.patch(
        f"/houses/{house_id}",
        json={"address_line1": "456 Elm St", "city": "New Town"},
    )

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["address_line1"] == "456 Elm St"
    assert payload["latitude"] == pytest.approx(41.0)
    assert payload["longitude"] == pytest.approx(-75.0)


def test_delete_house_removes_record(
    client: TestClient,
) -> None:
    create_response = client.post("/houses", json=build_payload())
    house_id = create_response.json()["id"]

    delete_response = client.delete(f"/houses/{house_id}")
    assert delete_response.status_code == status.HTTP_204_NO_CONTENT

    follow_up_response = client.get(f"/houses/{house_id}")
    assert follow_up_response.status_code == status.HTTP_404_NOT_FOUND


