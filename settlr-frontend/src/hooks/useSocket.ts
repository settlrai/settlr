import {
  SocketHookOptions,
  SocketHookReturn,
  SocketStatus,
} from "@/types/socket";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(options: SocketHookOptions): SocketHookReturn {
  const {
    url,
    path = "/socket.io/",
    onConnect,
    onDisconnect,
    onError,
    autoConnect = true,
  } = options;

  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const socketRef = useRef<Socket | null>(null);

  const connect = () => {
    if (socketRef.current?.connected) {
      return;
    }

    console.log("Connecting to Socket.IO server:", url);
    setStatus("connecting");

    const socket = io(url, {
      path,
      transports: ["websocket", "polling"],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket.IO connected");
      setStatus("connected");
      onConnect?.();
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.IO disconnected:", reason);
      setStatus("disconnected");
      onDisconnect?.(reason);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error);
      setStatus("error");
      onError?.(error);
    });
  };

  const disconnect = () => {
    if (socketRef.current) {
      console.log("Disconnecting Socket.IO");
      socketRef.current.disconnect();
      socketRef.current = null;
      setStatus("disconnected");
    }
  };

  const emit = (event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      console.log("Emitting event:", event, data);
      socketRef.current.emit(event, data);
    } else {
      console.warn("Socket not connected. Cannot emit:", event);
    }
  };

  const on: SocketHookReturn["on"] = (event, handler) => {
    if (socketRef.current) {
      socketRef.current.on<"map_update">(event, handler);
    }
  };

  const off: SocketHookReturn["off"] = (event, handler) => {
    if (socketRef.current) {
      if (handler) {
        socketRef.current.off<"map_update">(event, handler);
      } else {
        socketRef.current.off(event);
      }
    }
  };

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url, autoConnect]);

  return {
    socket: socketRef.current,
    status,
    emit,
    on,
    off,
    disconnect,
    connect,
    isConnected: status === "connected",
  };
}
