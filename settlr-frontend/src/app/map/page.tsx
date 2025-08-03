"use client";

import ResponsiveChat from "@/components/ResponsiveChat";
import RegionDetailsPanel from "@/components/RegionDetailsPanel";
import ConnectionStatus from "@/components/ConnectionStatus";
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  SOCKET_PATH,
  SOCKET_URL,
} from "@/constants/api";
import { useSocket } from "@/hooks/useSocket";
import { PolygonWithMeta } from "@/types/map";
import { SettlrEvents, RegionPointOfInterest } from "@/types/socket";
import { triggerGlobalFetch, triggerRegionFetch } from "@/utils/regionApi";
import { getOrCreateSessionId } from "@/utils/sessionUtils";
import { Loader } from "@googlemaps/js-api-loader";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = { lat: 51.5072, lng: -0.1276 };
const DEFAULT_ZOOM = 11;

// Generate random colors for polygons
const generateRandomColor = () => {
  const colors = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#6366f1",
    "#d946ef",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Map padding constants for sidebar chat layout
const getMapPadding = () => ({
  top: 20,
  right: Math.min(window.innerWidth * 0.3, 450) + 48, // Chat width + padding
  bottom: 20,
  left: 20,
});

const getSinglePolygonWithPanelPadding = () => ({
  top: 40,
  right: Math.min(window.innerWidth * 0.3, 450) + 48, // Chat width + padding
  bottom: 40,
  left: 256, // Left panel width (w-64)
});

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map>(null);
  const [showResetButton, setShowResetButton] = useState(false);
  const [mapPolygons, setMapPolygons] = useState<PolygonWithMeta[]>([]);
  const [singlePolygonInView, setSinglePolygonInView] = useState<number | null>(
    null
  );
  const [isLoadingRegionDetails, setIsLoadingRegionDetails] = useState(false);
  const [regionFetchError, setRegionFetchError] = useState<string | null>(null);
  const polygonInstancesRef = useRef<google.maps.Polygon[]>([]);
  const labelInstancesRef = useRef<google.maps.marker.AdvancedMarkerElement[]>(
    []
  );
  const poiMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const poiMarkerElementsRef = useRef<HTMLDivElement[]>([]);
  const [hoveredPOI, setHoveredPOI] = useState<string | null>(null);

  const [sessionId] = useState<string>(getOrCreateSessionId);

  // Store color mappings for polygons by area_name
  const polygonColorsRef = useRef<Map<string, string>>(new Map());

  const {
    status: socketStatus,
    on,
    off,
    isConnected,
  } = useSocket({
    url: SOCKET_URL,
    path: SOCKET_PATH,
    onConnect: () => {
      console.log("Socket.IO connected to map endpoint");
    },
    onDisconnect: (reason) => {
      console.log("Socket.IO disconnected:", reason);
    },
    onError: (error) => {
      console.error("Socket.IO error:", error);
    },
  });

  useEffect(() => {
    const handleMapUpdate: SettlrEvents["map_state"] = (data) => {
      console.log("Received map state update:", data);
      const polygonsWithColors = data.regions.map((region) => {
        const regionName = region.region_name;
        // Get existing color or generate new one
        let color = polygonColorsRef.current.get(regionName);
        if (!color) {
          color = generateRandomColor();
          polygonColorsRef.current.set(regionName, color);
        }

        return {
          id: region.region_id,
          coordinates: region.coordinates,
          region_name: regionName,
          color: color,
          points_of_interest: region.points_of_interest,
        };
      });

      setMapPolygons(polygonsWithColors);
      // Clear loading/error states when new data arrives
      setIsLoadingRegionDetails(false);
      setRegionFetchError(null);
    };

    if (isConnected) {
      on("map_state", handleMapUpdate);
    }

    return () => {
      off("map_state", handleMapUpdate);
    };
  }, [isConnected, on, off]);

  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
      });

      const { Map } = await loader.importLibrary("maps");

      if (mapRef.current) {
        const map = new Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          mapId: GOOGLE_MAPS_MAP_ID,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          backgroundColor: "#f5f5f5",
        });

        mapInstanceRef.current = map;

        const checkIfMapMoved = () => {
          const currentCenter = map.getCenter();
          const currentZoom = map.getZoom();

          if (currentCenter && currentZoom !== undefined) {
            const centerMoved =
              Math.abs(currentCenter.lat() - DEFAULT_CENTER.lat) > 0.001 ||
              Math.abs(currentCenter.lng() - DEFAULT_CENTER.lng) > 0.001;
            const zoomChanged = currentZoom !== DEFAULT_ZOOM;

            setShowResetButton(centerMoved || zoomChanged);
          }
        };

        map.addListener("center_changed", checkIfMapMoved);
        map.addListener("zoom_changed", checkIfMapMoved);
      }
    };

    initMap();
  }, []);

  const fitPolygonBounds = useCallback(() => {
    if (!mapInstanceRef.current || mapPolygons.length === 0) {
      return;
    }
    if (singlePolygonInView) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();

    mapPolygons.forEach((polygonWithArea) => {
      polygonWithArea.coordinates.forEach((coord) => {
        bounds.extend({ lat: coord[1], lng: coord[0] });
      });
    });

    mapInstanceRef.current.fitBounds(
      bounds,
      mapPolygons.length > 0
        ? getMapPadding()
        : { top: 20, right: 20, bottom: 120, left: 20 }
    );
  }, [mapPolygons, singlePolygonInView]);

  const fitSinglePolygonBounds = useCallback(
    (polygonCoords: google.maps.LatLngLiteral[]) => {
      if (!mapInstanceRef.current) {
        return;
      }

      const bounds = new google.maps.LatLngBounds();
      polygonCoords.forEach((coord) => bounds.extend(coord));

      // Always use panel padding when zooming to single polygon since panel will appear
      const padding = getSinglePolygonWithPanelPadding();

      mapInstanceRef.current.fitBounds(bounds, padding);
    },
    []
  );

  const createPOIMarker = async (
    poi: RegionPointOfInterest["points_of_interest"][0],
    poiId: string
  ) => {
    if (!mapInstanceRef.current) return null;

    const loader = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY,
      version: "weekly",
    });
    const { AdvancedMarkerElement } = await loader.importLibrary("marker");

    const markerDiv = document.createElement("div");
    markerDiv.className =
      "rounded-full bg-blue-500 border-2 border-white shadow-lg transition-all duration-200 w-3 h-3";
    markerDiv.style.cursor = "pointer";
    markerDiv.dataset.poiId = poiId;

    const marker = new AdvancedMarkerElement({
      position: {
        lat: poi.coordinates.latitude,
        lng: poi.coordinates.longitude,
      },
      map: mapInstanceRef.current,
      content: markerDiv,
    });

    return { marker, element: markerDiv };
  };

  const selectedPolygon = mapPolygons.find((p) => p.id === singlePolygonInView);

  useEffect(() => {
    const renderPolygons = async () => {
      if (!mapInstanceRef.current) {
        return;
      }

      // Clear existing polygons, labels, and POI markers
      polygonInstancesRef.current.forEach((polygon) => {
        polygon.setMap(null);
      });
      polygonInstancesRef.current = [];

      labelInstancesRef.current.forEach((label) => {
        label.map = null;
      });
      labelInstancesRef.current = [];

      poiMarkersRef.current.forEach((marker) => {
        marker.map = null;
      });
      poiMarkersRef.current = [];
      poiMarkerElementsRef.current = [];

      if (mapPolygons.length === 0) {
        return;
      }

      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
      });
      const { Polygon } = await loader.importLibrary("maps");
      const { AdvancedMarkerElement } = await loader.importLibrary("marker");

      mapPolygons.forEach((polygonWithArea) => {
        const polygonCoords = polygonWithArea.coordinates.map((coord) => ({
          lat: coord[1],
          lng: coord[0],
        }));

        const isSelected = singlePolygonInView === polygonWithArea.id;

        const polygonInstance = new Polygon({
          paths: polygonCoords,
          strokeColor: "#2D3748",
          strokeOpacity: 0.8,
          strokeWeight: isSelected ? 3 : 2,
          fillColor: polygonWithArea.color,
          fillOpacity: isSelected ? 0 : 0.2,
          map: mapInstanceRef.current,
        });

        // Add click event listener to select and zoom to this polygon
        polygonInstance.addListener("click", async () => {
          setSinglePolygonInView(polygonWithArea.id);
          fitSinglePolygonBounds(polygonCoords);

          // Trigger API call to fetch region details
          setIsLoadingRegionDetails(true);
          setRegionFetchError(null);

          try {
            await triggerRegionFetch(sessionId, polygonWithArea.id);
          } catch (error) {
            setRegionFetchError(
              error instanceof Error
                ? error.message
                : "Failed to fetch region details"
            );
            setIsLoadingRegionDetails(false);
          }
        });

        polygonInstancesRef.current.push(polygonInstance);

        // Calculate polygon center for label placement
        const bounds = new google.maps.LatLngBounds();
        polygonCoords.forEach((coord) => bounds.extend(coord));
        const center = bounds.getCenter();

        // Create label element only if no polygon is selected
        if (singlePolygonInView === null) {
          const labelDiv = document.createElement("div");
          labelDiv.className =
            "bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-sm font-medium text-gray-800 shadow-md border border-gray-200";
          labelDiv.textContent = polygonWithArea.region_name;

          // Create advanced marker for the label
          const labelMarker = new AdvancedMarkerElement({
            position: center,
            map: mapInstanceRef.current,
            content: labelDiv,
          });

          labelInstancesRef.current.push(labelMarker);
        }
      });

      // Render POI markers for selected polygon
      if (singlePolygonInView && selectedPolygon?.points_of_interest) {
        for (const poiGroup of selectedPolygon.points_of_interest) {
          for (const [index, poi] of poiGroup.points_of_interest.entries()) {
            const poiId = `${poiGroup.id}-${index}`;
            const markerData = await createPOIMarker(poi, poiId);
            if (markerData) {
              poiMarkersRef.current.push(markerData.marker);
              poiMarkerElementsRef.current.push(markerData.element);
            }
          }
        }
      }

      // Auto-zoom to fit all polygons when they're added
      if (mapPolygons.length > 0) {
        fitPolygonBounds();
      }
    };

    renderPolygons();
  }, [
    mapPolygons,
    fitPolygonBounds,
    fitSinglePolygonBounds,
    singlePolygonInView,
    sessionId,
    selectedPolygon,
  ]);

  // Handle POI marker hover effects
  useEffect(() => {
    poiMarkerElementsRef.current.forEach((element) => {
      const poiId = element.dataset.poiId;
      if (poiId === hoveredPOI) {
        element.className =
          "rounded-full bg-blue-500 border-2 border-white shadow-lg transition-all duration-200 w-6 h-6";
      } else {
        element.className =
          "rounded-full bg-blue-500 border-2 border-white shadow-lg transition-all duration-200 w-3 h-3";
      }
    });
  }, [hoveredPOI]);

  const resetMapView = () => {
    if (!mapInstanceRef.current) return;

    // Reset selection when going back to overview
    setSinglePolygonInView(null);
    setHoveredPOI(null);
    triggerGlobalFetch(sessionId);

    // If there are polygons, fit bounds to show all polygons
    if (mapPolygons.length > 0) {
      fitPolygonBounds();
    } else {
      // Otherwise, reset to default view
      mapInstanceRef.current.setCenter(DEFAULT_CENTER);
      mapInstanceRef.current.setZoom(DEFAULT_ZOOM);
    }
  };

  return (
    <div className="h-screen w-screen relative">
      {/* Map blur overlay for empty state */}
      {mapPolygons.length === 0 && (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] z-10" />
      )}
      <div ref={mapRef} className="h-full w-full" />

      {/* <PolygonToVideoLogic
        mapInstance={mapInstanceRef.current}
        mapPolygons={mapPolygons}
        singlePolygonInView={singlePolygonInView}
      /> */}

      {showResetButton && (
        <button
          onClick={resetMapView}
          className="absolute top-4 left-4 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 shadow-lg transition-all duration-200 text-sm font-medium text-gray-700 hover:text-gray-900 z-10"
        >
          Reset View
        </button>
      )}

      <RegionDetailsPanel
        selectedPolygon={selectedPolygon}
        isLoadingRegionDetails={isLoadingRegionDetails}
        regionFetchError={regionFetchError}
        hoveredPOI={hoveredPOI}
        onHoverPOI={setHoveredPOI}
        onBackToOverview={resetMapView}
      />

      <ConnectionStatus status={socketStatus} />

      <ResponsiveChat
        hasPolygons={mapPolygons.length > 0}
        sessionId={sessionId}
      />
    </div>
  );
}
