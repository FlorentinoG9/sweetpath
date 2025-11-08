"use client";

import maplibregl, { type LngLatBoundsLike, type Map } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useEffect, useRef } from "react";

import type { House } from "@/lib/api";
import "maplibre-gl/dist/maplibre-gl.css";

interface CandyMapProps {
    houses: House[];
    selectedHouseId: number | null;
    onSelectHouse: (houseId: number | null) => void;
    styleUrl: string;
}

type MarkerEntry = {
    marker: maplibregl.Marker;
    teardown: () => void;
};

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];

let pmtilesProtocol: Protocol | null = null;
let pmtilesRegistered = false;

function registerPmtilesProtocol() {
    if (typeof window === "undefined" || pmtilesRegistered) {
        return;
    }
    if (!pmtilesProtocol) {
        pmtilesProtocol = new Protocol();
    }
    maplibregl.addProtocol("pmtiles", pmtilesProtocol.tile.bind(pmtilesProtocol));
    pmtilesRegistered = true;
}

export function CandyMap({
    houses,
    selectedHouseId,
    onSelectHouse,
    styleUrl,
}: CandyMapProps) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<Map | null>(null);
    const markersRef = useRef<Map<number, MarkerEntry>>(new Map());
    const hasFittedBoundsRef = useRef(false);
    const previousCountRef = useRef(0);

    useEffect(() => {
        registerPmtilesProtocol();
    }, []);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) {
            return;
        }

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: styleUrl,
            center: DEFAULT_CENTER,
            zoom: 4,
            attributionControl: false,
        });

        map.addControl(new maplibregl.NavigationControl(), "top-left");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

        mapRef.current = map;

        return () => {
            markersRef.current.forEach(({ marker, teardown }) => {
                teardown();
                marker.remove();
            });
            markersRef.current.clear();
            map.remove();
            mapRef.current = null;
            hasFittedBoundsRef.current = false;
        };
    }, [styleUrl]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        const activeIds = new Set(houses.map((house) => house.id));
        markersRef.current.forEach(({ marker, teardown }, id) => {
            if (!activeIds.has(id)) {
                teardown();
                marker.remove();
                markersRef.current.delete(id);
            }
        });

        houses.forEach((house) => {
            const existing = markersRef.current.get(house.id);
            if (!existing) {
                const { element, teardown } = createMarkerElement(house, onSelectHouse);
                const marker = new maplibregl.Marker({ element })
                    .setLngLat([house.longitude, house.latitude])
                    .addTo(map);
                markersRef.current.set(house.id, { marker, teardown });
            } else {
                existing.marker.setLngLat([house.longitude, house.latitude]);
            }
        });

        markersRef.current.forEach(({ marker }, id) => {
            const element = marker.getElement();
            element.classList.toggle(
                "ring-2 ring-offset-2 ring-primary ring-offset-background scale-110",
                id === selectedHouseId,
            );
            element.setAttribute("aria-pressed", id === selectedHouseId ? "true" : "false");
        });

        if (houses.length > previousCountRef.current) {
            hasFittedBoundsRef.current = false;
        }

        if (
            houses.length > 0 &&
            (houses.length !== previousCountRef.current || !hasFittedBoundsRef.current)
        ) {
            const bounds = houses.reduce<maplibregl.LngLatBounds | null>((acc, house) => {
                const coord: [number, number] = [house.longitude, house.latitude];
                if (!acc) {
                    return new maplibregl.LngLatBounds(coord, coord);
                }
                return acc.extend(coord);
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
    }, [houses, onSelectHouse, selectedHouseId]);

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

    return (
        <div
            ref={mapContainerRef}
            className="h-[420px] w-full rounded-xl border border-border shadow-sm lg:h-full"
            role="application"
            aria-label="Map showing candy house locations"
        />
    );
}

function createMarkerElement(house: House, onSelectHouse: (houseId: number) => void) {
    const element = document.createElement("button");
    element.type = "button";
    element.className =
        "group rounded-full border border-white bg-primary text-white shadow-lg transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
    element.style.width = "18px";
    element.style.height = "18px";
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



