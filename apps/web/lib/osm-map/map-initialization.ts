import {
  AttributionControl,
  Map as MaplibreMapConstructor,
  NavigationControl,
} from "maplibre-gl";
import type { Map as MaplibreMap } from "maplibre-gl";
import { BLACK_STYLE_URL, GRAYSCALE_STYLE_URL } from "./types";

export interface MapInitOptions {
  container: HTMLDivElement;
  center: [number, number];
  zoom: number;
  theme: "dark" | "light" | null;
}

export function initializeMap({ container, center, zoom, theme }: MapInitOptions): MaplibreMap {
  const styleUrl = theme === "dark" ? BLACK_STYLE_URL : GRAYSCALE_STYLE_URL;

  const mapInstance = new MaplibreMapConstructor({
    container,
    style: styleUrl,
    center,
    zoom,
    attributionControl: false,
  });

  mapInstance.addControl(new NavigationControl({ visualizePitch: true }), "top-left");
  mapInstance.addControl(new AttributionControl({ compact: true }), "bottom-left");

  // Disable box zoom (Shift + drag) to prevent conflicts with marker creation
  mapInstance.boxZoom.disable();

  return mapInstance;
}

export function getStyleUrl(theme: "dark" | "light" | null): string {
  return theme === "dark" ? BLACK_STYLE_URL : GRAYSCALE_STYLE_URL;
}

