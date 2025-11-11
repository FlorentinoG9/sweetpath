import type { Map as MaplibreMap, } from "maplibre-gl";
import { create } from "zustand";
import type { Marker, MarkerInstance } from "@/lib/osm-map/types";

interface OsmMapStore {
  // State
  map: MaplibreMap | null;
  markers: Map<string, MarkerInstance>;
  markerData: Marker[];
  isInitialized: boolean;
  isMapReady: boolean;
  hasUserInteracted: boolean;
  isDragging: boolean;
  isDraggingMarker: boolean;
  draggingMarkerId: string | null;
  dragStart: { x: number; y: number } | null;
  initialCenter: [number, number];
  initialZoom: number;

  // Callbacks
  onMarkersChange?: (markers: Marker[]) => void;
  onMapReady?: (getCurrentCenter: () => [number, number] | null, centerMap: (lng: number, lat: number, zoom?: number) => void) => void;

  // Actions
  setMap: (map: MaplibreMap | null) => void;
  setMarkers: (markers: Marker[], notify?: boolean) => void;
  addMarker: (marker: Marker) => void;
  removeMarker: (id: string) => void;
  updateMarkerPosition: (id: string, lng: number, lat: number) => void;
  setMarkerInstance: (id: string, instance: MarkerInstance) => void;
  removeMarkerInstance: (id: string) => void;
  setIsInitialized: (value: boolean) => void;
  setIsMapReady: (value: boolean) => void;
  setHasUserInteracted: (value: boolean) => void;
  setIsDragging: (value: boolean) => void;
  setIsDraggingMarker: (value: boolean) => void;
  setDraggingMarkerId: (id: string | null) => void;
  setDragStart: (value: { x: number; y: number } | null) => void;
  setInitialCenter: (center: [number, number]) => void;
  setInitialZoom: (zoom: number) => void;
  setOnMarkersChange: (callback?: (markers: Marker[]) => void) => void;
  setOnMapReady: (callback?: (getCurrentCenter: () => [number, number] | null, centerMap: (lng: number, lat: number, zoom?: number) => void) => void) => void;
  resetDragState: () => void;
}

export const useOsmMapStore = create<OsmMapStore>((set, get) => ({
  // Initial state
  map: null,
  markers: new Map(),
  markerData: [],
  isInitialized: false,
  isMapReady: false,
  hasUserInteracted: false,
  isDragging: false,
  isDraggingMarker: false,
  draggingMarkerId: null,
  dragStart: null,
  initialCenter: [0, 0],
  initialZoom: 10,
  onMarkersChange: undefined,
  onMapReady: undefined,

  // Actions
  setMap: (map) => set({ map }),
  setMarkers: (markers, notify = true) => {
    const currentMarkers = get().markerData;
    // Only update if markers actually changed (compare by ID and position)
    const currentMap = new Map(currentMarkers.map((m) => [m.id, m]));
    const markersChanged =
      currentMarkers.length !== markers.length ||
      markers.some((marker) => {
        const current = currentMap.get(marker.id);
        return (
          !current ||
          Math.abs(current.lng - marker.lng) > 0.0001 ||
          Math.abs(current.lat - marker.lat) > 0.0001
        );
      }) ||
      currentMarkers.some((current) => !markers.find((m) => m.id === current.id));

    if (markersChanged) {
      set({ markerData: markers });
      if (notify) {
        const { onMarkersChange } = get();
        if (onMarkersChange) {
          // Use queueMicrotask for faster execution than setTimeout
          queueMicrotask(() => {
            onMarkersChange(markers);
          });
        }
      }
    }
  },
  addMarker: (marker) => {
    const { markerData } = get();
    const updated = [...markerData, marker];
    get().setMarkers(updated);
  },
  removeMarker: (id) => {
    const { markerData } = get();
    const updated = markerData.filter((m) => m.id !== id);
    get().setMarkers(updated);
  },
  updateMarkerPosition: (id, lng, lat) => {
    const { markerData } = get();
    const updated = markerData.map((m) => (m.id === id ? { ...m, lng, lat } : m));
    get().setMarkers(updated);
  },
  setMarkerInstance: (id, instance) => {
    const { markers } = get();
    const newMarkers = new Map(markers);
    newMarkers.set(id, instance);
    set({ markers: newMarkers });
  },
  removeMarkerInstance: (id) => {
    const { markers } = get();
    const newMarkers = new Map(markers);
    newMarkers.delete(id);
    set({ markers: newMarkers });
  },
  setIsInitialized: (value) => set({ isInitialized: value }),
  setIsMapReady: (value) => set({ isMapReady: value }),
  setHasUserInteracted: (value) => set({ hasUserInteracted: value }),
  setIsDragging: (value) => set({ isDragging: value }),
  setIsDraggingMarker: (value) => set({ isDraggingMarker: value }),
  setDraggingMarkerId: (id) => set({ draggingMarkerId: id }),
  setDragStart: (value) => set({ dragStart: value }),
  setInitialCenter: (center) => set({ initialCenter: center }),
  setInitialZoom: (zoom) => set({ initialZoom: zoom }),
  setOnMarkersChange: (callback) => set({ onMarkersChange: callback }),
  setOnMapReady: (callback) => set({ onMapReady: callback }),
  resetDragState: () => set({ isDragging: false, dragStart: null }),
}));

