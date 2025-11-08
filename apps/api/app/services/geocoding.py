"""Geocoding utilities powered by OpenStreetMap Nominatim."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import httpx

from ..config import settings


class GeocodingError(Exception):
    """Base geocoding exception."""


class AddressNotFoundError(GeocodingError):
    """Raised when an address cannot be resolved."""


@dataclass(frozen=True)
class GeocodeResult:
    latitude: float
    longitude: float


class Geocoder:
    """Resolve street addresses to latitude/longitude coordinates."""

    def __init__(
        self,
        *,
        base_url: str = settings.geocoding_base_url,
        user_agent: str = settings.geocoding_user_agent,
        timeout: float = settings.geocoding_timeout_seconds,
        client: Optional[httpx.Client] = None,
    ) -> None:
        headers = {"User-Agent": user_agent, "Accept": "application/json"}
        self._client = client or httpx.Client(
            base_url=base_url,
            headers=headers,
            timeout=timeout,
        )
        self._cache: dict[str, GeocodeResult] = {}

    def geocode(
        self,
        *,
        address_line1: str,
        address_line2: Optional[str],
        city: str,
        state: str,
        postal_code: str,
    ) -> GeocodeResult:
        query = self._build_query(
            address_line1=address_line1,
            address_line2=address_line2,
            city=city,
            state=state,
            postal_code=postal_code,
        )
        if query in self._cache:
            return self._cache[query]

        params = {
            "q": query,
            "format": "json",
            "limit": 1,
            "addressdetails": 0,
        }

        try:
            response = self._client.get("/search", params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:  # pragma: no cover - httpx already tested
            raise GeocodingError("Geocoding request failed.") from exc

        body = response.json()
        if not body:
            raise AddressNotFoundError("Address could not be geocoded.")

        result = self._parse_result(body[0])
        self._cache[query] = result
        return result

    @staticmethod
    def _build_query(
        *,
        address_line1: str,
        address_line2: Optional[str],
        city: str,
        state: str,
        postal_code: str,
    ) -> str:
        segments = [
            address_line1.strip(),
            address_line2.strip() if address_line2 else "",
            city.strip(),
            state.strip(),
            postal_code.strip(),
        ]
        return ", ".join(segment for segment in segments if segment)

    @staticmethod
    def _parse_result(payload: Any) -> GeocodeResult:
        try:
            latitude = float(payload["lat"])
            longitude = float(payload["lon"])
        except (KeyError, TypeError, ValueError) as exc:
            raise GeocodingError("Malformed response from geocoding provider.") from exc
        return GeocodeResult(latitude=latitude, longitude=longitude)

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()


def build_geocoder() -> Geocoder:
    """Factory to create a shared geocoder instance."""
    return Geocoder()


