import { Socket } from "socket.io-client";
import { Polygon } from "./map";

export type SocketStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface SocketHookOptions {
  url: string;
  path?: string;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}

export type RegionProperty = {
  address: string;
  area_sqm?: number | null;
  bathrooms?: number | null;
  bedrooms?: number | null;
  coordinates: string; // "[-0.0661841873748017,51.55924745049346]"
  description?: string | null;
  floor_plan_url?: string | null;
  id: number;
  images: string; // JSON string of image urls array
  price: number;
  property_id: number;
  property_link: string;
  search_area: string;
  search_query: string;
  source: string;
  title: string;
};
export type RegionPointOfInterest = {
  id: number;
  interest_type: string;
  points_of_interest: {
    name: string;
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    rating: number;
    review_count: number;
    categories: string[];
  }[];
};
type SettlrMapStateData = {
  conversation_id: string;
  properties?: RegionProperty[];
  regions: {
    conversation_id: string;
    region_id: number;
    coordinates: Polygon;
    region_name: string;
    created_at: string;
    points_of_interest: RegionPointOfInterest[];
  }[];
};
export type SettlrEvents = {
  map_state: (data: SettlrMapStateData) => void;
};

export interface SocketHookReturn {
  socket: Socket | null;
  status: SocketStatus;
  emit: (event: string, data?: unknown) => void;
  on: <K extends keyof SettlrEvents>(
    event: K,
    handler: SettlrEvents[K]
  ) => void;
  off: <K extends keyof SettlrEvents>(
    event: K,
    handler: SettlrEvents[K]
  ) => void;
  disconnect: () => void;
  connect: () => void;
  isConnected: boolean;
}
