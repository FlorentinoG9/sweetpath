"""Configuration helpers for the Candy Map API."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    database_url: str = "sqlite:///./candy_map.db"
    geocoding_base_url: str = "https://nominatim.openstreetmap.org"
    geocoding_user_agent: str = "sweetpath-candy-map/1.0"
    geocoding_timeout_seconds: float = 10.0
    cors_allow_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="CANDY_MAP_",
        extra="ignore",
    )


settings = Settings()


