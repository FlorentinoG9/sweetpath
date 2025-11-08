"""Unit tests for the geocoding service."""

import httpx
import pytest

from ..services.geocoding import AddressNotFoundError, GeocodingError, Geocoder


def build_geocoder_with_response(response_json: list[dict[str, str]], status_code: int = 200) -> Geocoder:
    call_counter = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_counter["count"] += 1
        return httpx.Response(status_code, json=response_json)

    transport = httpx.MockTransport(handler)
    client = httpx.Client(transport=transport, base_url="https://mocked.example")
    geocoder = Geocoder(base_url="https://mocked.example", client=client)
    geocoder._call_counter = call_counter  # type: ignore[attr-defined]
    return geocoder


def test_geocode_success_returns_coordinates() -> None:
    geocoder = build_geocoder_with_response([{"lat": "40.0", "lon": "-74.0"}])

    result = geocoder.geocode(
        address_line1="123 Main St",
        address_line2=None,
        city="Townsville",
        state="NY",
        postal_code="12345",
    )

    assert result.latitude == pytest.approx(40.0)
    assert result.longitude == pytest.approx(-74.0)
    assert geocoder._call_counter["count"] == 1  # type: ignore[index]

    # Second call should be served from cache and avoid additional HTTP call
    result_again = geocoder.geocode(
        address_line1="123 Main St",
        address_line2=None,
        city="Townsville",
        state="NY",
        postal_code="12345",
    )
    assert result_again == result
    assert geocoder._call_counter["count"] == 1  # type: ignore[index]


def test_geocode_without_results_raises_address_not_found() -> None:
    geocoder = build_geocoder_with_response([])
    with pytest.raises(AddressNotFoundError):
        geocoder.geocode(
            address_line1="Unknown Rd",
            address_line2=None,
            city="Example",
            state="ZZ",
            postal_code="00000",
        )


def test_geocode_http_error_raises_geocoding_error() -> None:
    geocoder = build_geocoder_with_response(
        [{"lat": "0", "lon": "0"}],
        status_code=500,
    )
    with pytest.raises(GeocodingError):
        geocoder.geocode(
            address_line1="123 Main St",
            address_line2=None,
            city="Townsville",
            state="NY",
            postal_code="12345",
        )


