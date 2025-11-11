"use client";

import { Marker as MaplibreMarkerConstructor } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { createMarkerDragHandlers, setupMapEventHandlers } from "@/lib/osm-map/event-handlers";
import { getStyleUrl, initializeMap } from "@/lib/osm-map/map-initialization";
import { createMarkerElement } from "@/lib/osm-map/marker-utils";
import type { Marker } from "@/lib/osm-map/types";
import { useOsmMapStore } from "@/stores/osm-map-store";

interface OsmMapProps {
  readonly center: [number, number];
  readonly zoom: number;
  readonly onMarkersChange?: (markers: Marker[]) => void;
  readonly initialMarkers?: Marker[];
  readonly onMapReady?: (getCurrentCenter: () => [number, number] | null, centerMap: (lng: number, lat: number, zoom?: number) => void) => void;
}

export function OsmMap({
  center,
  zoom,
  onMarkersChange,
  initialMarkers = [],
  onMapReady,
}: OsmMapProps) {
  const { resolvedTheme } = useTheme();

  // Calculate theme key early
  const themeKey: "dark" | "light" | null = resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : null;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cleanupEventHandlersRef = useRef<(() => void) | null>(null);
  const isMapInitializedRef = useRef(false);

  // Track previous values for imperative updates
  const prevCenterRef = useRef<[number, number] | null>(null);
  const prevZoomRef = useRef<number | null>(null);
  const prevThemeRef = useRef<"dark" | "light" | null>(null);
  const prevInitialMarkersRef = useRef<Marker[]>(initialMarkers);
  const prevOnMarkersChangeRef = useRef(onMarkersChange);
  const prevOnMapReadyRef = useRef(onMapReady);
  const lastSyncedMarkersKeyRef = useRef<string>("");

  // Capture initial values in refs for map initialization (must be declared early)
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(zoom);
  const initialThemeRef = useRef(themeKey);
  const initialMarkersRef = useRef(initialMarkers);

  const {
    map,
    markerData,
    isInitialized,
    isMapReady,
    hasUserInteracted,
    isDraggingMarker,
    setMarkers,
    setIsMapReady,
    setOnMarkersChange,
    setOnMapReady,
  } = useOsmMapStore();

  // Update callbacks in useEffect to avoid state updates during render
  useEffect(() => {
    if (prevOnMarkersChangeRef.current !== onMarkersChange) {
      prevOnMarkersChangeRef.current = onMarkersChange;
      setOnMarkersChange(onMarkersChange);
    }
  }, [onMarkersChange, setOnMarkersChange]);

  useEffect(() => {
    if (prevOnMapReadyRef.current !== onMapReady) {
      prevOnMapReadyRef.current = onMapReady;
      setOnMapReady(onMapReady);
    }
  }, [onMapReady, setOnMapReady]);

  // Sync initial markers in useEffect - sync whenever initialMarkers differs from store
  // Use efficient comparison instead of JSON.stringify for better performance
  useEffect(() => {
    // Quick length check first
    if (initialMarkers.length !== markerData.length) {
      const markersKey = `${initialMarkers.length}-${initialMarkers.map(m => m.id).join(',')}`;
      if (markersKey !== lastSyncedMarkersKeyRef.current) {
        lastSyncedMarkersKeyRef.current = markersKey;
        setMarkers(initialMarkers, false);
      }
      return;
    }

    // Deep comparison only if lengths match
    const hasChanged = initialMarkers.some((marker, index) => {
      const current = markerData[index];
      return (
        !current ||
        current.id !== marker.id ||
        Math.abs(current.lng - marker.lng) > 0.0001 ||
        Math.abs(current.lat - marker.lat) > 0.0001
      );
    }) || markerData.some((current, index) => {
      const marker = initialMarkers[index];
      return (
        !marker ||
        marker.id !== current.id ||
        Math.abs(marker.lng - current.lng) > 0.0001 ||
        Math.abs(marker.lat - current.lat) > 0.0001
      );
    });

    if (hasChanged) {
      const markersKey = `${initialMarkers.length}-${initialMarkers.map(m => m.id).join(',')}`;
      if (markersKey !== lastSyncedMarkersKeyRef.current) {
        lastSyncedMarkersKeyRef.current = markersKey;
        setMarkers(initialMarkers, false);
      }
    } else {
      // Keep ref in sync when values match
      const markersKey = `${initialMarkers.length}-${initialMarkers.map(m => m.id).join(',')}`;
      lastSyncedMarkersKeyRef.current = markersKey;
    }
  }, [initialMarkers, markerData, setMarkers]);

  // Imperative marker updates - wrapped in useCallback to stabilize reference
  // Access all data from store inside callback to avoid dependency on references
  const updateMarkersOnMap = useCallback(() => {
    if (!map || !isInitialized || !isMapReady || isDraggingMarker) {
      return;
    }

    // Access current state from store to ensure we always use the latest data
    const storeState = useOsmMapStore.getState();
    const currentMarkerInstances = storeState.markers;
    const currentMarkerData = storeState.markerData;

    const activeIds = new Set(currentMarkerData.map((m) => m.id));

    // Remove markers that are no longer in the list
    currentMarkerInstances.forEach(({ marker, teardown, handleDragStart, handleDragEnd }, id) => {
      if (!activeIds.has(id)) {
        if (handleDragStart) {
          marker.off("dragstart", handleDragStart);
        }
        if (handleDragEnd) {
          marker.off("dragend", handleDragEnd);
        }
        teardown();
        marker.remove();
        storeState.removeMarkerInstance(id);
      }
    });

    // Add new markers or update existing ones
    currentMarkerData.forEach((markerDataItem) => {
      if (!currentMarkerInstances.has(markerDataItem.id)) {
        const onRemove = () => {
          useOsmMapStore.getState().removeMarker(markerDataItem.id);
        };

        const { element, teardown } = createMarkerElement(markerDataItem, onRemove);
        const marker = new MaplibreMarkerConstructor({ element, draggable: true })
          .setLngLat([markerDataItem.lng, markerDataItem.lat])
          .addTo(map);

        const { handleDragStart, handleDragEnd } = createMarkerDragHandlers(
          markerDataItem.id,
          marker,
        );

        marker.on("dragstart", handleDragStart);
        marker.on("dragend", handleDragEnd);
        storeState.setMarkerInstance(markerDataItem.id, { marker, teardown, handleDragStart, handleDragEnd });
      } else {
        // Update existing marker position - but skip if this marker is currently being dragged
        // Position will be updated when drag ends
        const existing = currentMarkerInstances.get(markerDataItem.id);
        if (existing && storeState.draggingMarkerId !== markerDataItem.id) {
          existing.marker.setLngLat([markerDataItem.lng, markerDataItem.lat]);
        }
      }
    });
  }, [map, isInitialized, isMapReady, isDraggingMarker]);

  // Update center in useEffect
  useEffect(() => {
    const centerChanged =
      !prevCenterRef.current ||
      Math.abs(prevCenterRef.current[0] - center[0]) > 0.0001 ||
      Math.abs(prevCenterRef.current[1] - center[1]) > 0.0001;

    if (centerChanged) {
      if (map && isInitialized && isMapReady && !hasUserInteracted) {
        // Map is ready, update immediately
        const currentCenter = map.getCenter();
        const needsUpdate =
          Math.abs(currentCenter.lng - center[0]) > 0.0001 ||
          Math.abs(currentCenter.lat - center[1]) > 0.0001;

        if (needsUpdate) {
          map.easeTo({
            center,
            duration: 500,
          });
          prevCenterRef.current = center;
        }
      } else {
        // Map not ready yet, store the center for when it becomes ready
        prevCenterRef.current = center;
        // Update initial center ref so map initializes with correct center if not initialized yet
        if (!isInitialized) {
          initialCenterRef.current = center;
        }
      }
    }
  }, [center, map, isInitialized, isMapReady, hasUserInteracted]);

  // Update theme in useEffect
  useEffect(() => {
    if (map && isInitialized && prevThemeRef.current !== themeKey && themeKey !== null) {
      const styleUrl = getStyleUrl(themeKey);
      setIsMapReady(false);
      map.setStyle(styleUrl);

      // Wait for style to load before allowing marker operations
      map.once("style.load", () => {
        setIsMapReady(true);
        // Reposition all markers after style loads
        const { markers: currentMarkerInstances, markerData: currentMarkerData } = useOsmMapStore.getState();
        currentMarkerInstances.forEach(({ marker }, id) => {
          const markerDataItem = currentMarkerData.find((m) => m.id === id);
          if (markerDataItem) {
            marker.setLngLat([markerDataItem.lng, markerDataItem.lat]);
          }
        });
      });
      prevThemeRef.current = themeKey;
    }
  }, [themeKey, map, isInitialized, setIsMapReady]);

  // Update markers when markerData changes in useEffect
  // Use efficient comparison instead of JSON.stringify for better performance
  useEffect(() => {
    const currentLength = markerData.length;
    const prevLength = prevInitialMarkersRef.current.length;
    
    // Quick length check first
    if (currentLength !== prevLength) {
      prevInitialMarkersRef.current = markerData;
      updateMarkersOnMap();
      return;
    }

    // Deep comparison only if lengths match
    const hasChanged = markerData.some((marker, index) => {
      const prev = prevInitialMarkersRef.current[index];
      return (
        !prev ||
        prev.id !== marker.id ||
        Math.abs(prev.lng - marker.lng) > 0.0001 ||
        Math.abs(prev.lat - marker.lat) > 0.0001
      );
    });

    if (hasChanged) {
      prevInitialMarkersRef.current = markerData;
      updateMarkersOnMap();
    }
  }, [markerData, updateMarkersOnMap]);

  // Update refs when props change (for initial values) - these are safe during render
  useEffect(() => {
    if (initialCenterRef.current !== center) initialCenterRef.current = center;
    if (initialZoomRef.current !== zoom) initialZoomRef.current = zoom;
    if (initialThemeRef.current !== themeKey) initialThemeRef.current = themeKey;
    if (initialMarkersRef.current !== initialMarkers) initialMarkersRef.current = initialMarkers;
  }, [center, zoom, themeKey, initialMarkers]);

  // Initialize map imperatively using useLayoutEffect (only for DOM mounting)
  useLayoutEffect(() => {
    const storeState = useOsmMapStore.getState();

    // Initialize map only once
    if (!containerRef.current || storeState.map || isMapInitializedRef.current) {
      return;
    }

    isMapInitializedRef.current = true;
    storeState.setInitialCenter(initialCenterRef.current);
    storeState.setInitialZoom(initialZoomRef.current);

    const mapInstance = initializeMap({
      container: containerRef.current,
      center: initialCenterRef.current,
      zoom: initialZoomRef.current,
      theme: initialThemeRef.current,
    });

    // Setup event handlers
    const cleanup = setupMapEventHandlers(mapInstance);
    cleanupEventHandlersRef.current = cleanup;

    // Track user interactions to prevent automatic center updates
    const handleMapMove = () => {
      useOsmMapStore.getState().setHasUserInteracted(true);
    };

    mapInstance.on("move", handleMapMove);

    // Wait for map to be fully loaded before allowing marker creation
    mapInstance.once("load", () => {
      const currentStoreState = useOsmMapStore.getState();
      currentStoreState.setIsMapReady(true);

      // Apply pending center update if center changed after map initialization
      const pendingCenter = prevCenterRef.current;
      if (pendingCenter && !currentStoreState.hasUserInteracted) {
        const currentCenter = mapInstance.getCenter();
        const needsUpdate =
          Math.abs(currentCenter.lng - pendingCenter[0]) > 0.0001 ||
          Math.abs(currentCenter.lat - pendingCenter[1]) > 0.0001;

        if (needsUpdate) {
          mapInstance.easeTo({
            center: pendingCenter,
            duration: 500,
          });
        }
      }

      // Expose functions to get current center and center the map
      const { onMapReady: onMapReadyCallback } = currentStoreState;
      if (onMapReadyCallback) {
        const getCurrentCenter = (): [number, number] | null => {
          const currentMap = useOsmMapStore.getState().map;
          if (currentMap) {
            const currentCenter = currentMap.getCenter();
            return [currentCenter.lng, currentCenter.lat] as [number, number];
          }
          return null;
        };

        const centerMap = (lng: number, lat: number, zoomLevel?: number) => {
          const storeState = useOsmMapStore.getState();
          const currentMap = storeState.map;
          if (currentMap && storeState.isMapReady) {
            currentMap.flyTo({
              center: [lng, lat],
              zoom: zoomLevel ?? currentMap.getZoom(),
              duration: 1000,
            });
            // Reset user interaction flag so center prop updates work again
            storeState.setHasUserInteracted(false);
          }
        };

        onMapReadyCallback(getCurrentCenter, centerMap);
      }
    });

    storeState.setMap(mapInstance);
    storeState.setIsInitialized(true);
    prevCenterRef.current = initialCenterRef.current;
    prevZoomRef.current = initialZoomRef.current;
    prevThemeRef.current = initialThemeRef.current;

    // Initial marker sync
    if (initialMarkersRef.current.length > 0) {
      storeState.setMarkers(initialMarkersRef.current, false);
    }

    return () => {
      isMapInitializedRef.current = false;

      // Clean up event listeners
      if (mapInstance) {
        mapInstance.off("move", handleMapMove);
        if (cleanupEventHandlersRef.current) {
          cleanupEventHandlersRef.current();
        }
      }

      // Clean up markers - get fresh state for cleanup
      const currentMarkerInstances = useOsmMapStore.getState().markers;
      currentMarkerInstances.forEach(({ marker, teardown, handleDragStart, handleDragEnd }) => {
        if (handleDragStart) {
          marker.off("dragstart", handleDragStart);
        }
        if (handleDragEnd) {
          marker.off("dragend", handleDragEnd);
        }
        teardown();
        marker.remove();
      });

      if (mapInstance) {
        mapInstance.remove();
        const cleanupStoreState = useOsmMapStore.getState();
        cleanupStoreState.setMap(null);
        cleanupStoreState.setIsInitialized(false);
      }
    };
  }, []); // Only run once on mount

  return (
    <div
      ref={containerRef}
      className="size-full border border-border shadow-sm"
      role="application"
      aria-label="OpenStreetMap view"
    />
  );
}

// Export Marker type for external use
export type { Marker } from "@/lib/osm-map/types";
