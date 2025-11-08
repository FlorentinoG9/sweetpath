"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from typing import Protocol, TypedDict, cast

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import libsql  # type: ignore[import]

from . import crud, schemas
from .config import settings
from .database import Base, engine, get_db
from .dependencies import get_geocoder
from app.services.geocoding import AddressNotFoundError, GeocodingError, Geocoder

class LocationRecord(TypedDict):
    id: int
    latitude: float
    longitude: float
    vote: int


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Sweetpath Candy Map API", version="0.1.0", lifespan=lifespan)

class TursoCursor(Protocol):
    def fetchall(self) -> list[tuple[int, float, float, int]]: ...


class TursoConnection(Protocol):
    def execute(self, query: str) -> TursoCursor: ...


database_url = settings.database_url
database_auth_token = settings.database_auth_token

if not database_url:
    raise RuntimeError(
        "Database configuration missing. Set `CANDY_MAP_DATABASE_URL` in your environment."
    )

libsql_kwargs: dict[str, str] = {}
if database_url.startswith("libsql://"):
    if not database_auth_token:
        raise RuntimeError(
            "Turso auth token missing. Set `CANDY_MAP_DATABASE_AUTH_TOKEN` in your environment."
        )
    libsql_kwargs["auth_token"] = database_auth_token

conn = cast(
    TursoConnection,
    libsql.connect(  # type: ignore[attr-defined]
        database_url,
        **libsql_kwargs,
    ),
)

@app.get("/locations", tags=["locations"])
def get_locations() -> list[LocationRecord]:
    try:
        result = conn.execute("SELECT id, latitude, longitude, vote FROM location")
        rows = result.fetchall()
        if not rows:
            raise HTTPException(status_code=404, detail="No locations found")
        locations: list[LocationRecord] = [
            {
                "id": r[0],
                "latitude": r[1],
                "longitude": r[2],
                "vote": r[3]
            }
            for r in rows
        ]
        return locations
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB query failed: {str(e)}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Simple health probe."""
    return {"status": "ok"}


@app.get("/houses", response_model=list[schemas.HouseRead], tags=["houses"])
def list_houses(
    include_inactive: bool = Query(True, description="Include inactive houses in the response."),
    db: Session = Depends(get_db),
) -> list[schemas.HouseRead]:
    """Return candy house markers."""
    houses = crud.list_houses(db, include_inactive=include_inactive)
    return list(houses)


@app.get("/houses/{house_id}", response_model=schemas.HouseRead, tags=["houses"])
def get_house(
    house_id: int,
    db: Session = Depends(get_db),
) -> schemas.HouseRead:
    """Retrieve a single candy house."""
    db_house = crud.get_house(db, house_id)
    if not db_house:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="House not found.")
    return db_house


@app.post(
    "/houses",
    response_model=schemas.HouseRead,
    status_code=status.HTTP_201_CREATED,
    tags=["houses"],
)
def create_house(
    payload: schemas.HouseCreate,
    db: Session = Depends(get_db),
    geocoder: Geocoder = Depends(get_geocoder),
) -> schemas.HouseRead:
    """Create a new candy house marker."""
    try:
        house = crud.create_house(db, payload, geocoder)
    except AddressNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except GeocodingError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    return house


@app.patch("/houses/{house_id}", response_model=schemas.HouseRead, tags=["houses"])
def update_house(
    house_id: int,
    payload: schemas.HouseUpdate,
    db: Session = Depends(get_db),
    geocoder: Geocoder = Depends(get_geocoder),
) -> schemas.HouseRead:
    """Update an existing candy house marker."""
    db_house = crud.get_house(db, house_id)
    if not db_house:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="House not found.")
    try:
        return crud.update_house(db, db_house, payload, geocoder)
    except AddressNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except GeocodingError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@app.delete(
    "/houses/{house_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["houses"],
)
def delete_house(
    house_id: int,
    db: Session = Depends(get_db),
) -> None:
    """Delete a candy house marker."""
    db_house = crud.get_house(db, house_id)
    if not db_house:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="House not found.")
    crud.delete_house(db, db_house)


