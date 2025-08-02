import { SetMessagesAction } from "@/types/chat";
import { fetchEventSource } from "@microsoft/fetch-event-source";

export async function streamChatMessage(
  message: string,
  setMessages: SetMessagesAction
): Promise<void> {
  let assistantMessageIndex = -1;

  try {
    await fetchEventSource("http://localhost:8000/chat/stream", {
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
                content:
                  newMessages[assistantMessageIndex].content + event.data,
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
  } catch (error) {
    // Add error message to chat
    setMessages((prev) => [
      ...prev,
      {
        type: "error",
        content: `Error: ${
          error instanceof Error ? error.message : "Something went wrong"
        }`,
        isError: true,
      },
    ]);
    throw error;
  }
}
