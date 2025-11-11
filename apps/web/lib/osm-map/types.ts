import type { Map as MaplibreMap, Marker as MaplibreMarker } from "maplibre-gl";

export interface Marker {
  readonly id: string;
  readonly lng: number;
  readonly lat: number;
}

export interface MarkerInstance {
  marker: MaplibreMarker;
  teardown: () => void;
  handleDragStart?: () => void;
  handleDragEnd?: () => void;
}

export interface MapState {
  map: MaplibreMap | null;
  markers: Map<string, MarkerInstance>;
  isInitialized: boolean;
  isMapReady: boolean;
  hasUserInteracted: boolean;
  isDragging: boolean;
  isDraggingMarker: boolean;
  dragStart: { x: number; y: number } | null;
}

export interface MapConfig {
  center: [number, number];
  zoom: number;
  initialMarkers?: Marker[];
  onMarkersChange?: (markers: Marker[]) => void;
  onMapReady?: (getCurrentCenter: () => [number, number] | null) => void;
}

export const BLACK_STYLE_URL = "/map-style/osm-dark.json";
export const GRAYSCALE_STYLE_URL = "/map-style/osm-grayscale.json";

