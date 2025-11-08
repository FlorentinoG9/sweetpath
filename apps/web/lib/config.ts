const PROTOMAPS_HOST = "api.protomaps.com";
const DEFAULT_OSM_STYLE = "/map-style/osm.json";
const PROTOMAPS_DEFAULT_PMTILES =
  "https://api.protomaps.com/tiles/v3/planet/20240811.pmtiles";
const MAPLIBRE_FALLBACK_STYLE = "https://demotiles.maplibre.org/style.json";

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function getProtomapsApiKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_PROTOMAPS_API_KEY ??
    process.env.PROTOMAPS_API_KEY ??
    undefined
  );
}

function appendKeyParam(url: string, key: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("key")) {
      return parsed.toString();
    }
    parsed.searchParams.set("key", key.trim());
    return parsed.toString();
  } catch {
    return url;
  }
}

function shouldAugmentWithKey(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.host === PROTOMAPS_HOST;
  } catch {
    return false;
  }
}

export function getApiBaseUrl(): string {
  const value =
    process.env.NEXT_PUBLIC_CANDY_MAP_API_URL ??
    process.env.CANDY_MAP_API_URL ??
    "http://localhost:8000";
  return ensureTrailingSlash(value);
}

export function getPmtilesUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_PROTOMAPS_PMTILES_URL ?? PROTOMAPS_DEFAULT_PMTILES;
  const apiKey = getProtomapsApiKey();
  if (apiKey && shouldAugmentWithKey(base)) {
    return appendKeyParam(base, apiKey);
  }
  return base;
}

export function getMapStyleUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_PROTOMAPS_STYLE_URL ?? DEFAULT_OSM_STYLE;
  const apiKey = getProtomapsApiKey();

  if (shouldAugmentWithKey(configured)) {
    if (!apiKey) {
      return MAPLIBRE_FALLBACK_STYLE;
    }
    return appendKeyParam(configured, apiKey);
  }

  return configured;
}
