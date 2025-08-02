"use client";

import DraggableChat from "@/components/DraggableChat";
import { SOCKET_PATH, SOCKET_URL } from "@/constants/api";
import { Locations } from "@/constants/coords";
import { NeutralMapStyle } from "@/constants/mapThemes";
import { useSocket } from "@/hooks/useSocket";
import { SettlrEvents } from "@/types/socket";
import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";

const DEFAULT_CENTER = { lat: 51.5072, lng: -0.1276 };
const DEFAULT_ZOOM = 11;

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map>(null);
  const [showResetButton, setShowResetButton] = useState(false);

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
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
      const loader = new Loader({
        apiKey,
        version: "weekly",
      });

      const { Map, Polygon } = await loader.importLibrary("maps");

      if (mapRef.current) {
        const map = new Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          styles: NeutralMapStyle,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          backgroundColor: "#f5f5f5",
        });

        mapInstanceRef.current = map;

        const polygonCoords = Locations.CanaryWhart.map((coord) => ({
          lat: coord[1],
          lng: coord[0],
        }));

        new Polygon({
          paths: polygonCoords,
          strokeColor: "#2D3748",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#EDF2F7",
          fillOpacity: 0.35,
          map: map,
        });

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

  const resetMapView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(DEFAULT_CENTER);
      mapInstanceRef.current.setZoom(DEFAULT_ZOOM);
    }
  };

  return (
    <div className="h-screen w-screen relative">
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

      <DraggableChat />
    </div>
  );
}
