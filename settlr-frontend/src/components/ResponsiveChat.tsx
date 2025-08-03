"use client";

import { theme } from "@/constants/theme";
import { ChatMessagesState } from "@/types/chat";
import { streamChatMessage } from "@/utils/chatStreaming";
import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AnimatedInput from "./AnimatedInput";

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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
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
        <AnimatedInput
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Ask me about London neighborhoods and lifestyle preferences..."
          disabled={isLoading}
          isLoading={isLoading}
          inputValue={inputValue}
          onSubmit={handleSubmit}
          isCompact={false}
        />
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

        <AnimatedInput
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type your message..."
          disabled={isLoading}
          isLoading={isLoading}
          inputValue={inputValue}
          onSubmit={handleSubmit}
          isCompact={true}
        />
      </div>
    </div>
  );
}

export default memo(ResponsiveChat);
