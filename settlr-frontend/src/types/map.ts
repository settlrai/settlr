export type Polygon = [number, number][];

export interface PolygonWithArea {
  coordinates: Polygon;
  area_name: string;
  color: string;
}
