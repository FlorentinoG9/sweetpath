"use client";

import { Button } from "@workspace/ui/components/button";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Marker, OsmMap } from "@/components/osm-map";
import { ThemeToggle } from "@/components/theme-toggle";
import { useOsmMapStore } from "@/stores/osm-map-store";

export default function page() {
    const [markers, setMarkers] = useState<Marker[]>([]);
    const [center, setCenter] = useState<[number, number]>([-122.4194, 37.7749]);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [isRequestingLocation, setIsRequestingLocation] = useState(false);
    const getCurrentCenterRef = useRef<(() => [number, number] | null) | null>(null);
    const centerMapRef = useRef<((lng: number, lat: number, zoom?: number) => void) | null>(null);
    const hasRequestedLocationRef = useRef(false);

    // Request location permission and get user's location
    const requestUserLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser");
            return;
        }

        setIsRequestingLocation(true);
        setLocationError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { longitude, latitude } = position.coords;
                setCenter([longitude, latitude]);

                // Center the map on user's location if map is ready
                if (centerMapRef.current) {
                    centerMapRef.current(longitude, latitude, 15);
                }

                setIsRequestingLocation(false);
                hasRequestedLocationRef.current = true;
            },
            (error) => {
                setIsRequestingLocation(false);
                let errorMessage = "Unable to get your location";

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Location permission denied. Please enable location access in your browser settings.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Location information is unavailable.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Location request timed out.";
                        break;
                }

                setLocationError(errorMessage);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );
    }, []);

    // Center map on user's location (if we already have it)
    const centerOnMyLocation = useCallback(() => {
        if (centerMapRef.current && center) {
            centerMapRef.current(center[0], center[1], 15);
        } else {
            // If we don't have location yet, request it
            requestUserLocation();
        }
    }, [center, requestUserLocation]);

    // Automatically request location on mount
    useEffect(() => {
        if (!hasRequestedLocationRef.current) {
            requestUserLocation();
        }
    }, [requestUserLocation]);

    const handleAddMarkerAtCenter = () => {
        const store = useOsmMapStore.getState();
        const currentCenter = getCurrentCenterRef.current?.();

        if (!currentCenter) {
            // Fallback to initial center if map isn't ready
            const newMarker: Marker = {
                id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                lng: center[0],
                lat: center[1],
            };
            // Use store's addMarker to ensure consistency with CMD+click
            store.addMarker(newMarker);
            return;
        }

        const newMarker: Marker = {
            id: `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            lng: currentCenter[0],
            lat: currentCenter[1],
        };
        // Use store's addMarker to ensure consistency with CMD+click
        store.addMarker(newMarker);
    };

    return (
        <div className="flex h-screen flex-col">
            <div className="border-b border-border bg-background p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">Map with Markers</h1>
                        <p className="text-sm text-muted-foreground">
                            Hold Cmd/Ctrl + Click on the map to add markers, or use the button below
                        </p>
                        {locationError && (
                            <p className="text-sm text-destructive mt-1">{locationError}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={requestUserLocation}
                            variant="outline"
                            disabled={isRequestingLocation}
                        >
                            {isRequestingLocation ? "Getting Location..." : "Use My Location"}
                        </Button>
                        <Button
                            onClick={centerOnMyLocation}
                            variant="outline"
                            disabled={!centerMapRef.current}
                        >
                            Center on My Location
                        </Button>
                        <Button onClick={handleAddMarkerAtCenter} variant="default">
                            Add Marker at Center
                        </Button>
                        {markers.length > 0 && (
                            <Button
                                onClick={() => setMarkers([])}
                                variant="outline"
                            >
                                Clear All ({markers.length})
                            </Button>
                        )}
                    </div>
                    <ThemeToggle />
                </div>
            </div>
            <div className="flex flex-1">
                <OsmMap
                    center={center}
                    zoom={12}
                    initialMarkers={markers}
                    onMarkersChange={setMarkers}
                    onMapReady={(getCurrentCenter, centerMap) => {
                        getCurrentCenterRef.current = getCurrentCenter;
                        centerMapRef.current = centerMap;
                    }}
                />
            </div>
        </div>
    );
}
