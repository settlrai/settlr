"use client";

import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

async function streamChatMessage(
  message: string,
  setMessages: React.Dispatch<
    React.SetStateAction<
      { type: "user" | "assistant"; content: string; isStreaming?: boolean }[]
    >
  >
) {
  let assistantMessageIndex = -1;

  fetchEventSource("http://localhost:8000/chat/stream", {
    method: "POST",
    body: JSON.stringify({ message }),
    headers: {
      "Content-Type": "application/json",
    },
    async onopen(response) {
      const contentType = response.headers.get("content-type");
      if (response.ok && contentType === "text/event-stream; charset=utf-8") {
        setMessages((prev) => {
          const newMessages = [
            ...prev,
            { type: "assistant" as const, content: "", isStreaming: true },
          ];
          assistantMessageIndex = newMessages.length - 1;
          return newMessages;
        });
        return;
      } else if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      ) {
        throw new Error("Client side fatal error");
      } else {
        throw new Error("Backend error, retry");
      }
    },
    onmessage: (event) => {
      if (event.data && assistantMessageIndex !== -1) {
        if (event.data === "[DONE]") {
          setMessages((prev) => {
            const newMessages = [...prev];
            if (newMessages[assistantMessageIndex]) {
              newMessages[assistantMessageIndex] = {
                ...newMessages[assistantMessageIndex],
                isStreaming: false,
              };
            }
            return newMessages;
          });
          return;
        }

        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages[assistantMessageIndex]) {
            newMessages[assistantMessageIndex] = {
              ...newMessages[assistantMessageIndex],
              content: newMessages[assistantMessageIndex].content + event.data,
            };
          }
          return newMessages;
        });
      }
    },
    onerror: (err) => {
      console.error("Error in event source:", err);
      if (assistantMessageIndex !== -1) {
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages[assistantMessageIndex]) {
            newMessages[assistantMessageIndex] = {
              ...newMessages[assistantMessageIndex],
              isStreaming: false,
            };
          }
          return newMessages;
        });
      }
      throw err;
    },
    onclose: () => {
      if (assistantMessageIndex !== -1) {
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages[assistantMessageIndex]) {
            newMessages[assistantMessageIndex] = {
              ...newMessages[assistantMessageIndex],
              isStreaming: false,
            };
          }
          return newMessages;
        });
      }
    },
  });
}

interface DraggableChatProps {
  onFirstMessage?: () => void;
}

export default function DraggableChat({ onFirstMessage }: DraggableChatProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasMovedToSide, setHasMovedToSide] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<
    { type: "user" | "assistant"; content: string; isStreaming?: boolean }[]
  >([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!chatRef.current) return;

    setIsDragging(true);
    const rect = chatRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !chatRef.current) return;

    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;

    const maxX = window.innerWidth - chatRef.current.offsetWidth;
    const maxY = window.innerHeight - chatRef.current.offsetHeight;

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setMessages((prev) => [...prev, { type: "user", content: userMessage }]);
    setInputValue("");

    if (!hasMovedToSide) {
      setHasMovedToSide(true);
      const rightPosition = window.innerWidth - 400 - 20;
      const centerY = (window.innerHeight - 500) / 2;
      setPosition({ x: rightPosition, y: centerY });
      onFirstMessage?.();
    }

    streamChatMessage(userMessage, setMessages);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  useEffect(() => {
    if (!hasMovedToSide) {
      const centerX = (window.innerWidth - 400) / 2;
      const centerY = (window.innerHeight - 500) / 2;
      setPosition({ x: centerX, y: centerY });
    }
  }, [hasMovedToSide]);

  return (
    <div
      ref={chatRef}
      className={`fixed w-96 h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 z-50 cursor-move transition-all duration-700 ease-in-out ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: hasMovedToSide ? "none" : "translate(0, 0)",
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-2 rounded text-sm ${
                  message.type === "user"
                    ? "bg-blue-500 text-white ml-8"
                    : "bg-gray-50 text-gray-900 mr-8"
                }`}
              >
                {message.type === "user" ? (
                  message.content
                ) : (
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-900 prose-strong:text-gray-900 prose-code:text-gray-900 prose-pre:bg-gray-100">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )}
                {message.isStreaming && (
                  <span className="animate-pulse ml-1">▋</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onMouseDown={(e) => e.stopPropagation()}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
