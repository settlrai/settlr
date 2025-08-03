"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface VideoOverlayProps {
  isVisible: boolean;
  polygonCoords: google.maps.LatLngLiteral[];
  mapInstance: google.maps.Map | null;
  videoUrl?: string;
}

interface VideoState {
  isLoading: boolean;
  isPlaying: boolean;
  hasError: boolean;
  isMuted: boolean;
  showUnmuteButton: boolean;
}

export default function VideoOverlay({
  isVisible,
  polygonCoords,
  mapInstance,
  videoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
}: VideoOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [videoState, setVideoState] = useState<VideoState>({
    isLoading: true,
    isPlaying: false,
    hasError: false,
    isMuted: false,
    showUnmuteButton: false,
  });
  const [clipPath, setClipPath] = useState<string>("");

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string => {
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
    );
    return match ? match[1] : "dQw4w9WgXcQ";
  };

  const videoId = getYouTubeVideoId(videoUrl);

  // Convert lat/lng coordinates to screen pixels
  const latLngToPixel = useCallback(
    (latLng: google.maps.LatLngLiteral): { x: number; y: number } | null => {
      if (!mapInstance) return null;

      const projection = mapInstance.getProjection();
      if (!projection) return null;

      const bounds = mapInstance.getBounds();
      if (!bounds) return null;

      const mapDiv = mapInstance.getDiv();
      const mapWidth = mapDiv.offsetWidth;
      const mapHeight = mapDiv.offsetHeight;

      // Convert to world coordinates
      const worldCoordinate = projection.fromLatLngToPoint(latLng);
      if (!worldCoordinate) return null;

      // Get current map bounds in world coordinates
      const ne = projection.fromLatLngToPoint(bounds.getNorthEast());
      const sw = projection.fromLatLngToPoint(bounds.getSouthWest());

      if (!ne || !sw) return null;

      // Calculate pixel position
      const x = ((worldCoordinate.x - sw.x) / (ne.x - sw.x)) * mapWidth;
      const y = ((worldCoordinate.y - ne.y) / (sw.y - ne.y)) * mapHeight;

      return { x, y };
    },
    [mapInstance]
  );

  // Update clip path when map changes or polygon coordinates change
  useEffect(() => {
    if (!isVisible || !mapInstance) {
      setClipPath("");
      return;
    }

    // Generate SVG path string from polygon coordinates
    const generateClipPath = (): string => {
      if (!mapInstance || polygonCoords.length === 0) return "";

      const pixelCoords = polygonCoords
        .map((coord) => latLngToPixel(coord))
        .filter((coord) => coord !== null) as { x: number; y: number }[];

      if (pixelCoords.length === 0) return "";

      // Get map dimensions for percentage calculations
      const mapDiv = mapInstance.getDiv();
      const mapWidth = mapDiv.offsetWidth;
      const mapHeight = mapDiv.offsetHeight;

      // Convert pixel coordinates to percentages
      const pathPoints = pixelCoords.map(({ x, y }) => ({
        x: (x / mapWidth) * 100,
        y: (y / mapHeight) * 100,
      }));

      // Create polygon path string
      const pathString = pathPoints
        .map(
          (point, index) => `${index === 0 ? "" : " "}${point.x}% ${point.y}%`
        )
        .join(",");

      return `polygon(${pathString})`;
    };

    const updateClipPath = () => {
      const newClipPath = generateClipPath();
      setClipPath(newClipPath);
    };

    // Throttle function to limit update frequency
    let updateTimeout: NodeJS.Timeout | null = null;
    const throttledUpdateClipPath = () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(updateClipPath, 16); // ~60fps
    };

    // Initial clip path calculation
    updateClipPath();

    // Listen for map changes with throttling
    const listeners = [
      mapInstance.addListener("bounds_changed", throttledUpdateClipPath),
      mapInstance.addListener("zoom_changed", updateClipPath), // Immediate for zoom
      mapInstance.addListener("center_changed", throttledUpdateClipPath),
    ];

    return () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      listeners.forEach((listener) => {
        if (listener && listener.remove) {
          listener.remove();
        }
      });
    };
  }, [isVisible, mapInstance, polygonCoords, latLngToPixel]);

  // Calculate bounding box for video positioning (memoized for performance)
  const boundingBox = useMemo(() => {
    if (!mapInstance || polygonCoords.length === 0 || !isVisible) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    const pixelCoords = polygonCoords
      .map((coord) => latLngToPixel(coord))
      .filter((coord) => coord !== null) as { x: number; y: number }[];

    if (pixelCoords.length === 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    const minX = Math.min(...pixelCoords.map((p) => p.x));
    const maxX = Math.max(...pixelCoords.map((p) => p.x));
    const minY = Math.min(...pixelCoords.map((p) => p.y));
    const maxY = Math.max(...pixelCoords.map((p) => p.y));

    // Add padding to ensure video covers the polygon completely
    const padding = 50;

    return {
      left: minX - padding,
      top: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [mapInstance, polygonCoords, isVisible, latLngToPixel]);

  // Handle iframe load events
  const handleIframeLoad = () => {
    setVideoState((prev) => ({ ...prev, isLoading: false }));
  };

  const handleIframeError = () => {
    setVideoState((prev) => ({ ...prev, isLoading: false, hasError: true }));
  };


  if (!isVisible) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none z-20"
      style={{
        clipPath: clipPath || "none",
      }}
    >
      {/* Video iframe positioned to cover the polygon bounding box */}
      <iframe
        ref={iframeRef}
        className="absolute"
        style={{
          left: `${boundingBox.left}px`,
          top: `${boundingBox.top}px`,
          width: `${boundingBox.width}px`,
          height: `${boundingBox.height}px`,
          border: "none",
          objectFit: "cover",
        }}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1`}
        title="Area Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; microphone"
        allowFullScreen={false}
        onLoad={handleIframeLoad}
        onError={handleIframeError}
      />

      {/* Loading state */}
      {videoState.isLoading && (
        <div
          className="absolute bg-gray-200 animate-pulse flex items-center justify-center"
          style={{
            left: `${boundingBox.left}px`,
            top: `${boundingBox.top}px`,
            width: `${boundingBox.width}px`,
            height: `${boundingBox.height}px`,
          }}
        >
          <div className="text-gray-500 text-sm">Loading video...</div>
        </div>
      )}

      {/* Error state */}
      {videoState.hasError && (
        <div
          className="absolute bg-red-100 border border-red-300 flex items-center justify-center"
          style={{
            left: `${boundingBox.left}px`,
            top: `${boundingBox.top}px`,
            width: `${boundingBox.width}px`,
            height: `${boundingBox.height}px`,
          }}
        >
          <div className="text-red-700 text-sm text-center p-4">
            Failed to load video
          </div>
        </div>
      )}

    </div>
  );
}
