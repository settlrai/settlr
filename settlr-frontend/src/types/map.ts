import { RegionPointOfInterest } from "./socket";

export type Polygon = [number, number][];

export interface PolygonWithMeta {
  coordinates: Polygon;
  region_name: string;
  color: string;
  id: number;
  points_of_interest: RegionPointOfInterest[];
}
