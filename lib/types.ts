// SSE event types — shared between Route Handler (server) and page.tsx (client)
export type AgentEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "context_update"; messages: unknown[] }
  | { type: "done" }
  | { type: "error"; message: string };

// Conversation persistence types — shared between server (lib/conversations.ts) and client (app/page.tsx)
export type ConversationMeta = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
};

export type Conversation = ConversationMeta & {
  messages: unknown[];
  timeline: unknown[];
};
