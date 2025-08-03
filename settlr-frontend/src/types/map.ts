export type Polygon = [number, number][];

export interface PolygonWithArea {
  coordinates: Polygon;
  region_name: string;
  color: string;
  id: number;
}
