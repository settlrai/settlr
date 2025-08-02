"use client";

import { ChatMessagesState } from "@/types/chat";
import { streamChatMessage } from "@/utils/chatStreaming";
import { getOrCreateSessionId } from "@/utils/sessionUtils";
import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ResponsiveChatProps = {
  hasPolygons?: boolean;
};

function ResponsiveChat({ hasPolygons = false }: ResponsiveChatProps) {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessagesState>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");

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
    setSessionId(getOrCreateSessionId());
  }, []);

  useEffect(() => {
    const hasStreamingMessage = messages.some((msg) => msg.isStreaming);
    console.log("messages", messages);
    if (hasStreamingMessage) {
      scrollToBottom();
    }
  }, [messages]);

  // Check if there are any completed assistant messages
  const hasAssistantMessages = messages.some(
    (msg) => msg.type === "assistant" && !msg.isStreaming && !msg.isError && msg.content.trim()
  );

  // Empty state: full-width bottom input
  if (!hasPolygons && !hasAssistantMessages) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-6">
        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Ask me about London neighborhoods and lifestyle preferences..."
              className="flex-1 px-4 py-3 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base disabled:opacity-50"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                  Sending...
                </>
              ) : (
                "Send"
              )}
            </button>
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
                    ? "bg-blue-500 text-white ml-8"
                    : message.type === "error"
                    ? "bg-red-100 text-red-800 border border-red-300 mr-8"
                    : "bg-gray-50 text-gray-900 mr-8"
                }`}
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[80px] justify-center"
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
