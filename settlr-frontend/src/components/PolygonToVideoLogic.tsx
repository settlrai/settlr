import { PolygonWithArea } from "@/types/map";
import VideoOverlay from "./VideoOverlay";

interface VideoOverlayProps {
  singlePolygonInView: string | null;
  mapPolygons: PolygonWithArea[];
  mapInstance: google.maps.Map | null;
}

export default function PolygonToVideoLogic({
  singlePolygonInView,
  mapPolygons,
  mapInstance,
}: VideoOverlayProps) {
  return (
    <VideoOverlay
      isVisible={
        singlePolygonInView !== null &&
        mapPolygons.find((p) => p.area_name === singlePolygonInView) !==
          undefined
      }
      polygonCoords={
        mapPolygons
          .find((p) => p.area_name === singlePolygonInView)
          ?.coordinates.map((c) => ({
            lat: c[1],
            lng: c[0],
          })) ?? [{ lat: 0, lng: 0 }]
      }
      mapInstance={mapInstance}
    />
  );
}
