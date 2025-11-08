export function getApiBaseUrl(): string {
  const value =
    process.env.NEXT_PUBLIC_CANDY_MAP_API_URL ??
    process.env.CANDY_MAP_API_URL ??
    "http://localhost:8000";
  return value.endsWith("/") ? value : `${value}/`;
}

export function getPmtilesUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_PROTOMAPS_PMTILES_URL ??
    "https://api.protomaps.com/tiles/v3/planet/20240811.pmtiles";
  return base;
}

export function getMapStyleUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PROTOMAPS_STYLE_URL ??
    "https://api.protomaps.com/styles/v2/light.json"
  );
}


