# Sweetpath Candy Map

Community tool for mapping houses that hand out candy on Halloween night.  
The project consists of:

- **Next.js 16** frontend (`apps/web`) with a Protomaps-powered map and CRUD UI.
- **FastAPI** backend (`apps/api`) with SQLite storage, server-side geocoding, and REST endpoints.

## Prerequisites

- Node.js 18+ and `pnpm`
- Python 3.11+

## Environment Configuration

1. Backend
   ```bash
   cd apps/api
   cp env.example .env
   ```
   Adjust values if your frontend runs on a different origin or if you need a custom database location.

2. Frontend
   ```bash
   cd apps/web
   cp env.example .env.local
   ```
   Set `NEXT_PUBLIC_CANDY_MAP_API_URL` to the FastAPI base URL.  
   If you have a Protomaps API key or self-hosted PMTiles, update `NEXT_PUBLIC_PROTOMAPS_STYLE_URL`.

## Installing Dependencies

```bash
pnpm install
```

For the backend:

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate        # .venv\Scripts\activate on Windows
pip install -e .[dev]
```

## Running Locally

### FastAPI backend

```bash
cd apps/api
uvicorn app.main:app --reload
```

The API serves on `http://localhost:8000` by default.

### Next.js frontend

```bash
pnpm dev --filter web
```

Visit `http://localhost:3000` to view the map UI.

## Backend API

| Method | Path              | Description                    |
| ------ | ----------------- | ------------------------------ |
| GET    | `/health`         | Health check                   |
| GET    | `/houses`         | List houses (query `include_inactive`) |
| GET    | `/houses/{id}`    | Fetch a single house           |
| POST   | `/houses`         | Create a house (auto-geocodes) |
| PATCH  | `/houses/{id}`    | Update a house                 |
| DELETE | `/houses/{id}`    | Remove a house                 |

## Testing

```bash
cd apps/api
pytest
```

## Notes

- The backend geocodes addresses with OpenStreetMap Nominatim. Respect rate limits in production deployments.
- The frontend map consumes the Protomaps vector basemap. Provide your own hosted tiles or API key as needed.
