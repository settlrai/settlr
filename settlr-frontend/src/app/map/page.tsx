"use client";

import ResponsiveChat from "@/components/ResponsiveChat";
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  SOCKET_PATH,
  SOCKET_URL,
} from "@/constants/api";
import { useSocket } from "@/hooks/useSocket";
import { PolygonWithArea } from "@/types/map";
import { SettlrEvents } from "@/types/socket";
import { Loader } from "@googlemaps/js-api-loader";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = { lat: 51.5072, lng: -0.1276 };
const DEFAULT_ZOOM = 11;

// Map padding constants for sidebar chat layout
const getMapPadding = () => ({
  top: 20,
  right: Math.min(window.innerWidth * 0.3, 450) + 48, // Chat width + padding
  bottom: 20,
  left: 20,
});

const getSinglePolygonPadding = () => ({
  top: 40,
  right: Math.min(window.innerWidth * 0.3, 450) + 48, // Chat width + padding
  bottom: 40,
  left: 40,
});

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map>(null);
  const [showResetButton, setShowResetButton] = useState(false);
  const [mapPolygons, setMapPolygons] = useState<PolygonWithArea[]>([]);
  const polygonInstancesRef = useRef<google.maps.Polygon[]>([]);
  const labelInstancesRef = useRef<google.maps.marker.AdvancedMarkerElement[]>(
    []
  );

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
    const handleMapUpdate: SettlrEvents["map_update"] = (data) => {
      console.log("Received map update:", data);
      if (data.action === "add") {
        setMapPolygons((prev) => [
          ...prev,
          {
            coordinates: data.coordinates,
            area_name: data.area_name,
          },
        ]);
      }
    };

    if (isConnected) {
      on("map_update", handleMapUpdate);
    }

    return () => {
      off("map_update", handleMapUpdate);
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
  }, [mapPolygons]);

  const fitSinglePolygonBounds = useCallback(
    (polygonCoords: google.maps.LatLngLiteral[]) => {
      if (!mapInstanceRef.current) {
        return;
      }

      const bounds = new google.maps.LatLngBounds();
      polygonCoords.forEach((coord) => bounds.extend(coord));

      mapInstanceRef.current.fitBounds(bounds, getSinglePolygonPadding());
    },
    []
  );

  useEffect(() => {
    const renderPolygons = async () => {
      if (!mapInstanceRef.current) {
        return;
      }

      // Clear existing polygons and labels
      polygonInstancesRef.current.forEach((polygon) => {
        polygon.setMap(null);
      });
      polygonInstancesRef.current = [];

      labelInstancesRef.current.forEach((label) => {
        label.map = null;
      });
      labelInstancesRef.current = [];

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

        const polygonInstance = new Polygon({
          paths: polygonCoords,
          strokeColor: "#2D3748",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#EDF2F7",
          fillOpacity: 0.35,
          map: mapInstanceRef.current,
        });

        // Add click event listener to zoom to this polygon
        polygonInstance.addListener("click", () => {
          fitSinglePolygonBounds(polygonCoords);
        });

        polygonInstancesRef.current.push(polygonInstance);

        // Calculate polygon center for label placement
        const bounds = new google.maps.LatLngBounds();
        polygonCoords.forEach((coord) => bounds.extend(coord));
        const center = bounds.getCenter();

        // Create label element
        const labelDiv = document.createElement("div");
        labelDiv.className =
          "bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-sm font-medium text-gray-800 shadow-md border border-gray-200";
        labelDiv.textContent = polygonWithArea.area_name;

        // Create advanced marker for the label
        const labelMarker = new AdvancedMarkerElement({
          position: center,
          map: mapInstanceRef.current,
          content: labelDiv,
        });

        labelInstancesRef.current.push(labelMarker);
      });

      // Auto-zoom to fit all polygons when they're added
      if (mapPolygons.length > 0) {
        fitPolygonBounds();
      }
    };

    renderPolygons();
  }, [mapPolygons, fitPolygonBounds, fitSinglePolygonBounds]);

  const resetMapView = () => {
    if (!mapInstanceRef.current) return;

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

      {showResetButton && (
        <button
          onClick={resetMapView}
          className="absolute top-4 right-4 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 shadow-lg transition-all duration-200 text-sm font-medium text-gray-700 hover:text-gray-900 z-10"
        >
          Reset View
        </button>
      )}

      <div className="absolute top-4 left-4 z-10">
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            socketStatus === "connected"
              ? "bg-green-100 text-green-800 border border-green-300"
              : socketStatus === "connecting"
              ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
              : socketStatus === "error"
              ? "bg-red-100 text-red-800 border border-red-300"
              : "bg-gray-100 text-gray-800 border border-gray-300"
          }`}
        >
          {socketStatus === "connected" && "🟢 Connected"}
          {socketStatus === "connecting" && "🟡 Connecting..."}
          {socketStatus === "error" && "🔴 Error"}
          {socketStatus === "disconnected" && "⚫ Disconnected"}
        </div>
      </div>

      <ResponsiveChat hasPolygons={mapPolygons.length > 0} />
    </div>
  );
}
