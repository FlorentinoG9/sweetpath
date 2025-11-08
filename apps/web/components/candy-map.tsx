"use client";

import type {
    LngLatBounds,
    LngLatBoundsLike,
    Map as MaplibreMap,
    Marker as MaplibreMarker,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef, useState } from "react";

import type { House } from "@/lib/api";
import "maplibre-gl/dist/maplibre-gl.css";

type MaplibreModule = typeof import("maplibre-gl");

interface CandyMapProps {
    houses: House[];
    selectedHouseId: number | null;
    onSelectHouse: (houseId: number | null) => void;
    onCoordinateChange: (houseId: number, latitude: number, longitude: number) => void;
    styleUrl: string;
}

type MarkerEntry = {
    marker: MaplibreMarker;
    teardown: () => void;
    handleDragEnd: () => void;
};

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];

let pmtilesProtocol: Protocol | null = null;
let pmtilesRegistered = false;

const mapModuleRef: { current: MaplibreModule | null } = {
    current: null,
};

function watchMapReady(map: MaplibreMap, onReady: () => void) {
    if (map.isStyleLoaded()) {
        onReady();
        return () => undefined;
    }

    let isCancelled = false;

    function cleanup() {
        if (isCancelled) {
            return;
        }
        isCancelled = true;
        map.off("styledata", handleStyleData);
        map.off("load", handleLoad);
    }

    function handleStyleData() {
        if (isCancelled) {
            return;
        }
        if (!map.isStyleLoaded()) {
            return;
        }
        onReady();
        cleanup();
    }

    function handleLoad() {
        if (isCancelled) {
            return;
        }
        onReady();
        cleanup();
    }

    map.once("load", handleLoad);
    map.on("styledata", handleStyleData);

    return cleanup;
}

async function loadMaplibre(): Promise<MaplibreModule> {
    if (mapModuleRef.current) {
        return mapModuleRef.current;
    }
    const module = await import("maplibre-gl");
    mapModuleRef.current = module;
    return module;
}

function registerPmtiles(module: MaplibreModule) {
    if (typeof window === "undefined" || pmtilesRegistered) {
        return;
    }
    if (!pmtilesProtocol) {
        pmtilesProtocol = new Protocol();
    }
    module.addProtocol("pmtiles", pmtilesProtocol.tile.bind(pmtilesProtocol));
    pmtilesRegistered = true;
}

export function CandyMap({
    houses,
    selectedHouseId,
    onSelectHouse,
    onCoordinateChange,
    styleUrl,
}: CandyMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MaplibreMap | null>(null);
    const markersRef = useRef<Map<number, MarkerEntry>>(new Map());
    const hasFittedBoundsRef = useRef(false);
    const previousCountRef = useRef(0);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const styleReadyCleanupRef = useRef<(() => void) | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function ensureMap() {
            const maplibre = await loadMaplibre();
            if (cancelled) {
                return;
            }
            registerPmtiles(maplibre);

            if (!mapContainerRef.current) {
                return;
            }

            if (mapRef.current) {
                styleReadyCleanupRef.current?.();
                setIsMapReady(false);
                const currentMap = mapRef.current;
                currentMap.setStyle(styleUrl);
                styleReadyCleanupRef.current = watchMapReady(currentMap, () => setIsMapReady(true));
                return;
            }

            const map = new maplibre.Map({
                container: mapContainerRef.current,
                style: styleUrl,
                center: DEFAULT_CENTER,
                zoom: 4,
                attributionControl: false,
            });

            map.addControl(new maplibre.NavigationControl(), "top-left");
            map.addControl(new maplibre.AttributionControl({ compact: true }), "bottom-left");

            mapRef.current = map;
            map.resize();
            setIsMapReady(Boolean(map.isStyleLoaded()));
            styleReadyCleanupRef.current = watchMapReady(map, () => setIsMapReady(true));
        }

        void ensureMap();

        return () => {
            cancelled = true;
            const map = mapRef.current;
            if (!map) {
                return;
            }
            markersRef.current.forEach(({ marker, teardown, handleDragEnd }) => {
                teardown();
                marker.off("dragend", handleDragEnd);
                marker.remove();
            });
            markersRef.current.clear();
            map.remove();
            mapRef.current = null;
            hasFittedBoundsRef.current = false;
            if (resizeObserverRef.current && mapContainerRef.current) {
                resizeObserverRef.current.unobserve(mapContainerRef.current);
            }
            styleReadyCleanupRef.current?.();
            styleReadyCleanupRef.current = null;
            setIsMapReady(false);
        };
    }, [styleUrl]);

    useEffect(() => {
        const map = mapRef.current;
        const maplibre = mapModuleRef.current;
        if (!map || !maplibre || !isMapReady) {
            return;
        }

        const activeIds = new Set(houses.map((house) => house.id));
        markersRef.current.forEach(({ marker, teardown, handleDragEnd }, id) => {
            if (!activeIds.has(id)) {
                marker.off("dragend", handleDragEnd);
                teardown();
                marker.remove();
                markersRef.current.delete(id);
            }
        });

        houses.forEach((house) => {
            const existing = markersRef.current.get(house.id);
            if (!existing) {
                const { element, teardown } = createMarkerElement(house, onSelectHouse);
                const marker = new maplibre.Marker({ element, draggable: house.id === selectedHouseId })
                    .setLngLat([house.longitude, house.latitude])
                    .addTo(map);
                const handleDragEnd = () => {
                    const position = marker.getLngLat();
                    onCoordinateChange(house.id, position.lat, position.lng);
                };
                marker.on("dragend", handleDragEnd);
                markersRef.current.set(house.id, { marker, teardown, handleDragEnd });
            } else {
                existing.marker.off("dragend", existing.handleDragEnd);
                existing.marker.setLngLat([house.longitude, house.latitude]);
                const handleDragEnd = () => {
                    const position = existing.marker.getLngLat();
                    onCoordinateChange(house.id, position.lat, position.lng);
                };
                existing.marker.on("dragend", handleDragEnd);
                markersRef.current.set(house.id, {
                    marker: existing.marker,
                    teardown: existing.teardown,
                    handleDragEnd,
                });
            }
        });

        markersRef.current.forEach(({ marker }, id) => {
            const element = marker.getElement();
            const isSelected = id === selectedHouseId;
            const activeTokens = ["ring-2", "ring-offset-2", "ring-primary", "ring-offset-background"];
            activeTokens.forEach((token) => {
                element.classList.toggle(token, isSelected);
            });
            element.style.transform = isSelected ? "scale(1.1)" : "scale(1)";
            element.style.transformOrigin = "center";
            element.setAttribute("aria-pressed", isSelected ? "true" : "false");
            marker.setDraggable(isSelected);
        });

        if (houses.length > previousCountRef.current) {
            hasFittedBoundsRef.current = false;
        }

        if (
            houses.length > 0 &&
            (houses.length !== previousCountRef.current || !hasFittedBoundsRef.current)
        ) {
            const bounds = houses.reduce<LngLatBounds | null>((acc, house) => {
                const coordinate: [number, number] = [house.longitude, house.latitude];
                if (!acc) {
                    return new maplibre.LngLatBounds(coordinate, coordinate);
                }
                acc.extend(coordinate);
                return acc;
            }, null);

            if (bounds) {
                map.fitBounds(bounds as LngLatBoundsLike, {
                    padding: 48,
                    maxZoom: 16,
                    duration: 750,
                });
                hasFittedBoundsRef.current = true;
            }
        }
        previousCountRef.current = houses.length;
    }, [houses, isMapReady, onCoordinateChange, onSelectHouse, selectedHouseId]);

    useEffect(() => {
        if (!selectedHouseId) {
            return;
        }
        const map = mapRef.current;
        if (!map) {
            return;
        }
        const target = houses.find((house) => house.id === selectedHouseId);
        if (!target) {
            return;
        }
        map.easeTo({
            center: [target.longitude, target.latitude],
            zoom: Math.max(map.getZoom(), 14),
            duration: 600,
        });
    }, [houses, selectedHouseId]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        if (!resizeObserverRef.current && "ResizeObserver" in window) {
            resizeObserverRef.current = new ResizeObserver(() => {
                if (mapRef.current) {
                    mapRef.current.resize();
                }
            });
        }
        if (mapContainerRef.current && resizeObserverRef.current) {
            resizeObserverRef.current.observe(mapContainerRef.current);
        }
        return () => {
            if (mapContainerRef.current && resizeObserverRef.current) {
                resizeObserverRef.current.unobserve(mapContainerRef.current);
            }
        };
    }, []);

    return (
        <div
            ref={mapContainerRef}
            className="h-[60vh] w-full border border-border shadow-sm lg:h-full"
            role="application"
            aria-label="Map showing candy house locations"
        />
    );
}

function createMarkerElement(house: House, onSelectHouse: (houseId: number | null) => void) {
    const element = document.createElement("button");
    element.type = "button";
    element.className =
        "group inline-flex items-center justify-center rounded-full border border-white bg-white/80 shadow-lg transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
    element.style.width = "40px";
    element.style.height = "40px";
    element.style.borderRadius = "9999px";
    element.style.border = "2px solid rgba(255,255,255,0.95)";
    element.style.boxShadow = "0 8px 18px rgba(0,0,0,0.28)";
    element.style.padding = "6px";
    element.style.color = "#ea580c";
    element.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="100%" height="100%" aria-hidden="true">
            <g fill="currentColor">
                <path opacity="0.4" d="M11 16.0007H7C3.6914 16.0007 1 13.3093 1 10.0007C1 6.6921 3.6914 4.0007 7 4.0007C7.6816 4.0007 8.3525 4.11689 9 4.34689C9.6475 4.11689 10.3184 4.0007 11 4.0007C14.3086 4.0007 17 6.6921 17 10.0007C17 13.3093 14.3086 16.0007 11 16.0007Z" />
                <path d="M5.30602 10.0007H7.64601C7.82901 10.0007 7.99702 9.9017 8.08402 9.7417C8.17202 9.5817 8.16502 9.3877 8.06702 9.2327L6.89702 7.3887C6.71302 7.0997 6.23701 7.0997 6.05301 7.3887L4.88301 9.2327C4.78501 9.3867 4.77901 9.5817 4.86601 9.7417C4.95401 9.9017 5.12202 10.0007 5.30402 10.0007H5.30602Z" />
                <path d="M10.354 10.0007H12.694C12.877 10.0007 13.045 9.9017 13.132 9.7417C13.22 9.5817 13.213 9.3877 13.115 9.2327L11.945 7.3887C11.761 7.0997 11.285 7.0997 11.101 7.3887L9.93099 9.2327C9.83299 9.3867 9.82699 9.5817 9.91399 9.7417C10.002 9.9017 10.17 10.0007 10.352 10.0007H10.354Z" />
                <path d="M13.146 11.2857C13.047 11.0777 12.817 10.9687 12.595 11.0107C11.899 11.1517 11.2 11.2397 10.5 11.2987V12.0017C10.5 12.2777 10.276 12.5017 9.99999 12.5017H9.49999C9.22399 12.5017 8.99999 12.2777 8.99999 12.0017V11.3747C7.79899 11.3747 6.59798 11.2537 5.40499 11.0117C5.17899 10.9687 4.95299 11.0787 4.85399 11.2867C4.75499 11.4937 4.80999 11.7417 4.98799 11.8877C6.31899 12.9837 7.65899 13.5317 8.99999 13.5317C10.341 13.5317 11.681 12.9837 13.012 11.8877C13.19 11.7417 13.244 11.4927 13.146 11.2857Z" />
                <path d="M9 4.34689C9.5595 4.14819 10.1384 4.05149 10.7247 4.02439C10.7699 3.33619 11.0099 2.49879 11.4599 1.44749C11.5204 1.30639 11.5126 1.14529 11.4384 1.01049C11.3652 0.876193 11.2333 0.782994 11.082 0.757594L9.582 0.507594C9.4082 0.481194 9.2295 0.543688 9.1162 0.679988C8.3002 1.65509 7.8047 2.79279 7.5994 4.05209C8.0741 4.10039 8.5442 4.18509 9 4.34689Z" />
            </g>
        </svg>
    `;
    element.setAttribute("aria-label", `Select ${house.name}`);
    element.tabIndex = 0;

    const handleClick = () => {
        onSelectHouse(house.id);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectHouse(house.id);
        }
        if (event.key === "Escape") {
            event.preventDefault();
            onSelectHouse(null);
        }
    };

    element.addEventListener("click", handleClick);
    element.addEventListener("keydown", handleKeyDown);

    return {
        element,
        teardown: () => {
            element.removeEventListener("click", handleClick);
            element.removeEventListener("keydown", handleKeyDown);
        },
    };
}



