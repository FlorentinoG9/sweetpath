"""Pydantic schemas for API validation."""

from datetime import time
from typing import Optional

from pydantic import BaseModel, Field, constr


AddressStr = constr(min_length=1, max_length=200)
PostalCodeStr = constr(min_length=1, max_length=20)
CityStr = constr(min_length=1, max_length=120)
StateStr = constr(min_length=1, max_length=120)


class HouseBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address_line1: AddressStr
    address_line2: Optional[AddressStr] = None
    city: CityStr
    state: StateStr
    postal_code: PostalCodeStr
    treats_description: Optional[constr(max_length=500)] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_active: bool = True


class HouseCreate(HouseBase):
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class HouseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    address_line1: Optional[AddressStr] = None
    address_line2: Optional[AddressStr] = None
    city: Optional[CityStr] = None
    state: Optional[StateStr] = None
    postal_code: Optional[PostalCodeStr] = None
    treats_description: Optional[constr(max_length=500)] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_active: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class HouseRead(HouseBase):
    id: int
    latitude: float
    longitude: float
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


