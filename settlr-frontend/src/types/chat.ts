export type MessageType = "user" | "assistant" | "error";

export interface ChatMessage {
  type: MessageType;
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
}

export type ChatMessagesState = ChatMessage[];

export type SetMessagesAction = React.Dispatch<
  React.SetStateAction<ChatMessagesState>
>;
