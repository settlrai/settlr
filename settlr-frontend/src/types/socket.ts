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

type SettlrMapStateData = {
  conversation_id: string;
  regions: {
    conversation_id: string;
    id: number;
    coordinates: Polygon;
    region_name: string;
    created_at: string;
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
