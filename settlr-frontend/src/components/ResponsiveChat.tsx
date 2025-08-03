"use client";

import { theme } from "@/constants/theme";
import { ChatMessagesState } from "@/types/chat";
import { streamChatMessage } from "@/utils/chatStreaming";
import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ResponsiveChatProps = {
  hasPolygons?: boolean;
  sessionId: string;
};

function ResponsiveChat({
  hasPolygons = false,
  sessionId,
}: ResponsiveChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessagesState>([]);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const removeErrorMessages = () => {
    setMessages((prev) => prev.filter((msg) => !msg.isError));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Remove error messages when user starts typing
    if (value.length > 0) {
      removeErrorMessages();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();

    removeErrorMessages();
    setIsLoading(true);

    setMessages((prev) => [...prev, { type: "user", content: userMessage }]);
    setInputValue("");

    try {
      await streamChatMessage(
        {
          message: userMessage,
          conversation_id: sessionId,
        },
        setMessages
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const hasStreamingMessage = messages.some((msg) => msg.isStreaming);
    if (hasStreamingMessage) {
      scrollToBottom();
    }
  }, [messages]);

  // Check if there are any completed assistant messages
  const hasAssistantMessages = messages.some(
    (msg) =>
      msg.type === "assistant" &&
      !msg.isStreaming &&
      !msg.isError &&
      msg.content.trim()
  );

  // Empty state: centered search bar with animated border
  if (!hasPolygons && !hasAssistantMessages) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <form onSubmit={handleSubmit} className="w-4/5 max-w-[1550px]">
          <div className="search-animated-border rounded-lg">
            <div className="search-inner">
              <div className="relative bg-white/90 backdrop-blur-sm rounded-lg">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="Ask me about London neighborhoods and lifestyle preferences..."
                  className="w-full px-4 py-3 pr-20 bg-transparent border-none rounded-lg focus:outline-none focus:ring-0 disabled:opacity-50 text-base placeholder-gray-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 text-gray-600 rounded-md focus:outline-none font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors hover:text-gray-800"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span className="sr-only">Sending...</span>
                    </>
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // Sidebar state: right panel with messages
  return (
    <div
      className="fixed top-6 right-6 bottom-6 z-50 transition-all duration-700 ease-in-out"
      style={{ width: "min(30vw, 450px)" }}
    >
      <div className="h-full bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-200 flex flex-col">
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-2">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`p-2 rounded text-sm ${
                  message.type === "user"
                    ? "text-white ml-8"
                    : message.type === "error"
                    ? "bg-red-100 text-red-800 border border-red-300 mr-8"
                    : "bg-gray-50 text-gray-900 mr-8"
                }`}
                style={
                  message.type === "user"
                    ? { backgroundColor: theme.semantic.chat.userMessage }
                    : {}
                }
              >
                {message.type === "user" ? (
                  message.content
                ) : message.type === "error" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-red-500">⚠️</span>
                    {message.content}
                  </div>
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
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 disabled:opacity-50"
              style={
                {
                  borderColor: theme.semantic.input.border,
                  "--tw-ring-color": theme.semantic.input.borderFocus,
                } as React.CSSProperties
              }
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[80px] justify-center"
              style={
                {
                  backgroundColor: theme.semantic.button.primary.background,
                  "--tw-ring-color": theme.semantic.button.primary.background,
                } as React.CSSProperties
              }
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.semantic.button.primary.backgroundHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.semantic.button.primary.background;
              }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="sr-only">Sending...</span>
                </>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default memo(ResponsiveChat);
