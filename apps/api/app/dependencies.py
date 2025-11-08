"""Shared dependency providers."""

from functools import lru_cache

from .services.geocoding import Geocoder, build_geocoder


@lru_cache(maxsize=1)
def get_geocoder() -> Geocoder:
    """Return a cached Geocoder instance."""
    return build_geocoder()


