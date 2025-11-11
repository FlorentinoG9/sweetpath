import type { Map as MaplibreMap } from "maplibre-gl";
import { useOsmMapStore } from "@/stores/osm-map-store";
import { generateMarkerId } from "./marker-utils";

const DRAG_THRESHOLD = 5; // pixels

export function setupMapEventHandlers(map: MaplibreMap): () => void {
  // Track user interactions to prevent automatic center updates
  const handleMapMove = () => {
    useOsmMapStore.getState().setHasUserInteracted(true);
  };

  // Track modifier key state to ignore drag detection when adding markers
  let modifierKeyPressedDuringMouseDown = false;

  // Track drag state to prevent marker creation during map drag
  const handleMouseDown = (e: { originalEvent: MouseEvent }) => {
    const store = useOsmMapStore.getState();
    // Check if modifier key is pressed during mousedown
    modifierKeyPressedDuringMouseDown = e.originalEvent.metaKey || e.originalEvent.ctrlKey;
    store.setIsDragging(false);
    store.setDragStart(null);
  };

  const handleMouseMove = (e: { point: { x: number; y: number } }) => {
    const store = useOsmMapStore.getState();
    const { dragStart } = store;
    
    // Don't track drag if modifier key was pressed during mousedown (user is trying to add marker)
    if (modifierKeyPressedDuringMouseDown) {
      return;
    }
    
    if (dragStart === null) {
      store.setDragStart({ x: e.point.x, y: e.point.y });
      return;
    }

    const dx = Math.abs(e.point.x - dragStart.x);
    const dy = Math.abs(e.point.y - dragStart.y);

    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      store.setIsDragging(true);
    }
  };

  const handleMouseUp = () => {
    const store = useOsmMapStore.getState();
    // Reset drag state on mouse up
    store.setDragStart(null);
    // Reset modifier key flag
    modifierKeyPressedDuringMouseDown = false;
    // Small delay to ensure click handler can check drag state before it's reset
    setTimeout(() => {
      store.setIsDragging(false);
    }, 0);
  };

  // Add click handler to create markers (only if Cmd/Ctrl + click and not dragging)
  const handleClick = (e: {
    lngLat: { lng: number; lat: number };
    point: { x: number; y: number };
    originalEvent: MouseEvent;
  }) => {
    // Get fresh store state on each click
    const currentStore = useOsmMapStore.getState();
    const { isDragging, isMapReady } = currentStore;

    // Check for Cmd (Mac) or Ctrl (Windows/Linux) key
    const isModifierPressed = e.originalEvent.metaKey || e.originalEvent.ctrlKey;

    // Don't create marker if user was dragging (and modifier wasn't pressed during mousedown), 
    // map isn't ready, or modifier key isn't pressed
    // If modifier was pressed during mousedown, ignore drag state (user is adding marker)
    const shouldIgnoreDrag = modifierKeyPressedDuringMouseDown;
    if ((!shouldIgnoreDrag && isDragging) || !isMapReady || !isModifierPressed) {
      currentStore.resetDragState();
      return;
    }

    // Get coordinates from the event first (before preventing default)
    // The lngLat from MapLibre's click event should be accurate
    let lng = e.lngLat.lng;
    let lat = e.lngLat.lat;

    // Validate coordinates - if they seem invalid, use unproject as fallback
    // Note: (0, 0) is a valid coordinate (Gulf of Guinea), so we don't reject it
    if (
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      Math.abs(lng) > 180 ||
      Math.abs(lat) > 90
    ) {
      // Fallback: convert point to lngLat
      const lngLat = map.unproject([e.point.x, e.point.y]);
      lng = lngLat.lng;
      lat = lngLat.lat;
    }

    // Prevent any default behavior for Cmd/Ctrl+Click after we've captured coordinates
    e.originalEvent.preventDefault();
    e.originalEvent.stopPropagation();

    const newMarker = {
      id: generateMarkerId(),
      lng,
      lat,
    };

    currentStore.addMarker(newMarker);
    currentStore.resetDragState();
  };

  map.on("move", handleMapMove);
  map.on("mousedown", handleMouseDown);
  map.on("mousemove", handleMouseMove);
  map.on("mouseup", handleMouseUp);
  map.on("click", handleClick);

  // Return cleanup function
  return () => {
    map.off("move", handleMapMove);
    map.off("mousedown", handleMouseDown);
    map.off("mousemove", handleMouseMove);
    map.off("mouseup", handleMouseUp);
    map.off("click", handleClick);
  };
}

export function createMarkerDragHandlers(
  markerId: string,
  marker: { getLngLat: () => { lng: number; lat: number } },
) {
  const store = useOsmMapStore.getState();

  const handleDragStart = () => {
    store.setIsDraggingMarker(true);
    store.setDraggingMarkerId(markerId);
  };

  const handleDragEnd = () => {
    const position = marker.getLngLat();
    // Update position only when drag ends
    store.updateMarkerPosition(markerId, position.lng, position.lat);
    // Reset flags after a short delay to allow state update
    setTimeout(() => {
      store.setIsDraggingMarker(false);
      store.setDraggingMarkerId(null);
    }, 100);
  };

  return { handleDragStart, handleDragEnd };
}

