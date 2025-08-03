"use client";

import ConnectionStatus from "@/components/ConnectionStatus";
import RegionDetailsPanel from "@/components/RegionDetailsPanel";
import ResponsiveChat from "@/components/ResponsiveChat";
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  SOCKET_PATH,
  SOCKET_URL,
} from "@/constants/api";
import { useSocket } from "@/hooks/useSocket";
import { PolygonWithMeta } from "@/types/map";
import {
  RegionPointOfInterest,
  RegionProperty,
  SettlrEvents,
} from "@/types/socket";
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
  const [mapProperties, setMapProperties] = useState<RegionProperty[]>([]);
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
  const propertyMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>(
    []
  );
  const propertyMarkerElementsRef = useRef<HTMLDivElement[]>([]);
  const [hoveredPOI, setHoveredPOI] = useState<string | null>(null);
  const [hoveredProperty, setHoveredProperty] = useState<number | null>(null);

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
      const polygonsWithColors = data.regions
        .map((region) => {
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
        })
        .filter((reg) => reg.id !== null);

      setMapPolygons(polygonsWithColors);

      // Process properties if present
      if (data.properties && data.properties.length > 0) {
        setMapProperties(data.properties);
      } else {
        setMapProperties([]);
      }

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
      "rounded-lg bg-yellow-100 border-2 border-white shadow-lg transition-all duration-200 w-6 h-6 flex items-center justify-center";
    markerDiv.style.cursor = "pointer";
    markerDiv.innerHTML = poi.emoji;
    markerDiv.dataset.poiId = poiId;

    // Create popup element
    const popupDiv = document.createElement("div");
    popupDiv.className =
      "absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 min-w-64 max-w-80 opacity-0 pointer-events-none transition-opacity duration-200";
    popupDiv.style.zIndex = "9999";
    
    // Generate star rating HTML
    const stars = [...Array(5)].map((_, i) => 
      `<svg class="w-3 h-3 ${i < Math.floor(poi.rating) ? 'text-yellow-400' : 'text-gray-300'}" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>`
    ).join('');

    // Generate tags HTML
    const tagsHtml = poi.categories.length > 0 
      ? `<div class="flex flex-wrap gap-1 mt-2">
          ${poi.categories.slice(0, 3).map(cat => 
            `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">${cat}</span>`
          ).join('')}
          ${poi.categories.length > 3 ? `<span class="text-xs text-gray-500">+${poi.categories.length - 3} more</span>` : ''}
        </div>`
      : '';

    popupDiv.innerHTML = `
      <div class="font-medium text-gray-800 text-sm mb-1">${poi.name}</div>
      <div class="flex items-center gap-2 mb-1">
        <div class="flex items-center">${stars}</div>
        <span class="text-xs text-gray-600">${poi.rating.toFixed(1)} (${poi.review_count} reviews)</span>
      </div>
      <div class="text-xs text-gray-600 mb-1">${poi.address}</div>
      ${tagsHtml}
    `;

    // Container for marker and popup
    const containerDiv = document.createElement("div");
    containerDiv.className = "relative";
    containerDiv.style.zIndex = "1";
    containerDiv.appendChild(markerDiv);
    containerDiv.appendChild(popupDiv);

    const marker = new AdvancedMarkerElement({
      position: {
        lat: poi.coordinates.latitude,
        lng: poi.coordinates.longitude,
      },
      map: mapInstanceRef.current,
      content: containerDiv,
      zIndex: 1,
    });

    // Add hover events
    containerDiv.addEventListener("mouseenter", () => {
      popupDiv.classList.remove("opacity-0", "pointer-events-none");
      popupDiv.classList.add("opacity-100", "pointer-events-auto");
      containerDiv.style.zIndex = "2000";
      // Update the marker's zIndex when hovered
      marker.zIndex = 1000;
      setHoveredPOI(poiId);
    });

    containerDiv.addEventListener("mouseleave", () => {
      popupDiv.classList.add("opacity-0", "pointer-events-none");
      popupDiv.classList.remove("opacity-100", "pointer-events-auto");
      containerDiv.style.zIndex = "1";
      // Reset the marker's zIndex
      marker.zIndex = 1;
      setHoveredPOI(null);
    });

    return { marker, element: markerDiv };
  };

  const createPropertyMarker = async (
    property: RegionProperty,
    propertyId: number
  ) => {
    if (!mapInstanceRef.current) return null;

    const loader = new Loader({
      apiKey: GOOGLE_MAPS_API_KEY,
      version: "weekly",
    });
    const { AdvancedMarkerElement } = await loader.importLibrary("marker");

    // Parse coordinates from string format like "[-0.0661841873748017,51.55924745049346]"
    const coordinates = JSON.parse(property.coordinates);
    const [lng, lat] = coordinates;

    // Create property marker element
    const markerDiv = document.createElement("div");
    markerDiv.className =
      "rounded-lg bg-green-500 border-2 border-white shadow-lg transition-all duration-200 w-6 h-6 flex items-center justify-center";
    markerDiv.style.cursor = "pointer";
    markerDiv.dataset.propertyId = propertyId.toString();
    markerDiv.innerHTML = "🏠";
    markerDiv.style.fontSize = "12px";

    // Create popup element
    const popupDiv = document.createElement("div");
    popupDiv.className =
      "absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 min-w-48 opacity-0 pointer-events-none transition-opacity duration-200";
    popupDiv.style.zIndex = "9999";
    popupDiv.innerHTML = `
      <div class="font-medium text-gray-800 mb-2 text-sm">${property.title}</div>
      <a href="${property.property_link}" target="_blank" class="inline-block bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded transition-colors">
        View Property
      </a>
    `;

    // Container for marker and popup
    const containerDiv = document.createElement("div");
    containerDiv.className = "relative";
    containerDiv.style.zIndex = "1";
    containerDiv.appendChild(markerDiv);
    containerDiv.appendChild(popupDiv);

    const marker = new AdvancedMarkerElement({
      position: { lat, lng },
      map: mapInstanceRef.current,
      content: containerDiv,
      zIndex: 1,
    });

    // Add hover events
    containerDiv.addEventListener("mouseenter", () => {
      popupDiv.classList.remove("opacity-0", "pointer-events-none");
      popupDiv.classList.add("opacity-100", "pointer-events-auto");
      containerDiv.style.zIndex = "2000";
      // Update the marker's zIndex when hovered
      marker.zIndex = 1000;
      setHoveredProperty(propertyId);
    });

    containerDiv.addEventListener("mouseleave", () => {
      popupDiv.classList.add("opacity-0", "pointer-events-none");
      popupDiv.classList.remove("opacity-100", "pointer-events-auto");
      containerDiv.style.zIndex = "1";
      // Reset the marker's zIndex
      marker.zIndex = 1;
      setHoveredProperty(null);
    });

    return { marker, element: markerDiv };
  };

  const selectedPolygon = mapPolygons.find((p) => p.id === singlePolygonInView);

  useEffect(() => {
    const renderPolygons = async () => {
      if (!mapInstanceRef.current) {
        return;
      }

      // Clear existing polygons, labels, POI markers, and property markers
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

      propertyMarkersRef.current.forEach((marker) => {
        marker.map = null;
      });
      propertyMarkersRef.current = [];
      propertyMarkerElementsRef.current = [];

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
          const shouldRefetch = singlePolygonInView !== polygonWithArea.id;
          setSinglePolygonInView(polygonWithArea.id);
          fitSinglePolygonBounds(polygonCoords);

          if (shouldRefetch) {
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

      // Render property markers when zoomed into a region
      if (singlePolygonInView && mapProperties.length > 0) {
        for (const property of mapProperties) {
          const markerData = await createPropertyMarker(property, property.id);
          if (markerData) {
            propertyMarkersRef.current.push(markerData.marker);
            propertyMarkerElementsRef.current.push(markerData.element);
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
    mapProperties,
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
          "rounded-lg bg-yellow-200 border-2 border-yellow-400 shadow-xl transition-all duration-200 w-8 h-8 flex items-center justify-center scale-110";
      } else {
        element.className =
          "rounded-lg bg-yellow-100 border-2 border-white shadow-lg transition-all duration-200 w-6 h-6 flex items-center justify-center";
      }
    });
  }, [hoveredPOI]);

  // Handle property marker hover effects
  useEffect(() => {
    propertyMarkerElementsRef.current.forEach((element) => {
      const propertyId = element.dataset.propertyId;
      if (propertyId === hoveredProperty?.toString()) {
        element.className =
          "rounded-lg bg-green-500 border-2 border-white shadow-lg transition-all duration-200 w-8 h-8 flex items-center justify-center";
      } else {
        element.className =
          "rounded-lg bg-green-500 border-2 border-white shadow-lg transition-all duration-200 w-6 h-6 flex items-center justify-center";
      }
    });
  }, [hoveredProperty]);

  const resetMapView = () => {
    if (!mapInstanceRef.current) return;

    // Reset selection when going back to overview
    setSinglePolygonInView(null);
    setHoveredPOI(null);
    setHoveredProperty(null);
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
