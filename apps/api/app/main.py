"""FastAPI application entrypoint."""

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import libsql

from . import crud, models, schemas
from .config import settings
from .database import Base, engine, get_db
from .dependencies import get_geocoder
from .services.geocoding import AddressNotFoundError, GeocodingError, Geocoder

app = FastAPI(title="Sweetpath Candy Map API", version="0.1.0")

TURSO_DATABASE_URL = "libsql://my-geo-db-loaa.aws-us-east-1.turso.io" 
TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjI1NzI1MzgsImlkIjoiODBjMGM4MzQtZmE5Yi00M2VjLWI1ZGEtMTYyOTA5YWNiNTY0IiwicmlkIjoiNjYzYzMwNDItYWM1YS00YTMyLWEwMTYtNGY1ODFhZDJiZjlhIn0.LfR5pESawtXzioTLIGzgRuHb2Dvpzg5czMJraA4JQTuIBzZV_hXbAeA_ZeAyDKGilHwGz281RJf3rCUITDo5AA" 

conn = libsql.connect(TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN)

@app.get("/locations", tags=["locations"])
def get_locations():
    try:
        result = conn.execute("SELECT id, latitude, longitude, vote FROM location")
        rows = result.fetchall()
        if not rows:
            raise HTTPException(status_code=404, detail="No locations found")
        return [
            {
                "id": r[0],
                "latitude": r[1],
                "longitude": r[2],
                "vote": r[3]
            }
            for r in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB query failed: {str(e)}")


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """Apply database schema on startup."""
    Base.metadata.create_all(bind=engine)


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


