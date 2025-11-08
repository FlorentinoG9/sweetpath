"""SQLAlchemy models for candy houses."""

from datetime import datetime, time

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Time, func

from .database import Base


class House(Base):
    """Represents a house offering candy."""

    __tablename__ = "houses"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    name = Column(String(200), nullable=False)
    address_line1 = Column(String(200), nullable=False)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(120), nullable=False)
    state = Column(String(120), nullable=False)
    postal_code = Column(String(20), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    treats_description = Column(String(500), nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return (
            "House(id={id}, name={name}, city={city}, state={state}, "
            "latitude={latitude}, longitude={longitude})"
        ).format(
            id=self.id,
            name=self.name,
            city=self.city,
            state=self.state,
            latitude=self.latitude,
            longitude=self.longitude,
        )


