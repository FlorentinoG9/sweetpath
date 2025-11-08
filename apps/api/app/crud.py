"""Database CRUD helpers."""

from collections.abc import Iterable
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas
from .services.geocoding import GeocodeResult, GeocodingError, Geocoder


def list_houses(db: Session, include_inactive: bool = True) -> Iterable[models.House]:
    """Return houses ordered newest first."""
    stmt = select(models.House).order_by(models.House.created_at.desc())
    if not include_inactive:
        stmt = stmt.where(models.House.is_active.is_(True))
    return db.scalars(stmt).all()


def get_house(db: Session, house_id: int) -> Optional[models.House]:
    """Return a single house by id."""
    return db.get(models.House, house_id)


def _ensure_lat_lon(
    geocoder: Geocoder,
    payload: schemas.HouseBase,
    latitude: Optional[float],
    longitude: Optional[float],
) -> GeocodeResult:
    if latitude is not None and longitude is not None:
        return GeocodeResult(latitude=latitude, longitude=longitude)
    if (latitude is None) != (longitude is None):
        raise GeocodingError("Latitude and longitude must be provided together.")
    return geocoder.geocode(
        address_line1=payload.address_line1,
        address_line2=payload.address_line2,
        city=payload.city,
        state=payload.state,
        postal_code=payload.postal_code,
    )


def create_house(
    db: Session,
    house_in: schemas.HouseCreate,
    geocoder: Geocoder,
) -> models.House:
    """Create a new house after ensuring coordinates."""
    geocode = _ensure_lat_lon(geocoder, house_in, house_in.latitude, house_in.longitude)
    new_house = models.House(
        **house_in.model_dump(
            exclude={"latitude", "longitude"},
        ),
        latitude=geocode.latitude,
        longitude=geocode.longitude,
    )
    db.add(new_house)
    db.commit()
    db.refresh(new_house)
    return new_house


def update_house(
    db: Session,
    db_house: models.House,
    house_in: schemas.HouseUpdate,
    geocoder: Geocoder,
) -> models.House:
    """Update a house record and refresh coordinates if the address changes."""
    update_data = house_in.model_dump(exclude_unset=True)
    address_fields = {"address_line1", "address_line2", "city", "state", "postal_code"}

    latitude = update_data.pop("latitude", None)
    longitude = update_data.pop("longitude", None)
    address_changed = any(field in update_data for field in address_fields)

    if address_changed or (latitude is not None and longitude is not None):
        payload = schemas.HouseBase(
            **{
                "name": update_data.get("name", db_house.name),
                "address_line1": update_data.get("address_line1", db_house.address_line1),
                "address_line2": update_data.get("address_line2", db_house.address_line2),
                "city": update_data.get("city", db_house.city),
                "state": update_data.get("state", db_house.state),
                "postal_code": update_data.get("postal_code", db_house.postal_code),
                "treats_description": update_data.get("treats_description", db_house.treats_description),
                "start_time": update_data.get("start_time", db_house.start_time),
                "end_time": update_data.get("end_time", db_house.end_time),
                "is_active": update_data.get("is_active", db_house.is_active),
            }
        )
        geocode = _ensure_lat_lon(geocoder, payload, latitude, longitude)
        db_house.latitude = geocode.latitude
        db_house.longitude = geocode.longitude
    elif (latitude is None) != (longitude is None):
        raise GeocodingError("Latitude and longitude must be provided together.")

    for field, value in update_data.items():
        setattr(db_house, field, value)

    db.add(db_house)
    db.commit()
    db.refresh(db_house)
    return db_house


def delete_house(db: Session, db_house: models.House) -> None:
    """Delete a house record."""
    db.delete(db_house)
    db.commit()


