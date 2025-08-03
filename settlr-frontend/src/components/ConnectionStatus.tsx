"use client";

import { SocketStatus } from "@/types/socket";

interface ConnectionStatusProps {
  status: SocketStatus;
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <div className="absolute bottom-20 left-4 z-10">
      <div
        className={`px-3 py-1 rounded-full text-xs font-medium ${
          status === "connected"
            ? "bg-green-100 text-green-800 border border-green-300"
            : status === "connecting"
            ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
            : status === "error"
            ? "bg-red-100 text-red-800 border border-red-300"
            : "bg-gray-100 text-gray-800 border border-gray-300"
        }`}
      >
        {status === "connected" && "🟢 Connected"}
        {status === "connecting" && "🟡 Connecting..."}
        {status === "error" && "🔴 Error"}
        {status === "disconnected" && "⚫ Disconnected"}
      </div>
    </div>
  );
}