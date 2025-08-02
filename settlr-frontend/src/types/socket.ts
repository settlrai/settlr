import { Socket } from "socket.io-client";

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

type Polygon = [number, number][];

type SettlrMapUpdateData = {
  type: "map_update";
  action: "add";
  area_name: string;
  timestamp: number;
  coordinates: Polygon;
};
export type SettlrEvents = {
  map_update: (data: SettlrMapUpdateData) => void;
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
