// ── Plan / Reflect types ──────────────────────────────────────────────────────

export type PlanStep = {
  id: string;
  description: string;
  tool_hints: string[];
  success_criteria: string;
  status: "pending" | "done" | "failed";
  error?: string;
};

export type Plan = {
  can_answer_directly: boolean;
  direct_answer?: string;
  goal: string;
  steps: PlanStep[];
};

export type ReflectResult = {
  goal_achieved: boolean;
  summary: string;
  decision: "done" | "back_to_plan";
};

export type RollbackStrategy = "none" | "snapshot" | "saga";

export type PlanContext = {
  previousFailures: Array<{
    stepDescription: string;
    error: string;
    completedSteps: string[];
  }>;
};

export type ReactGuard = {
  maxIterations: number;
  toolTimeoutMs: number;
  seenCalls: Set<string>;
};

export type StepResult =
  | { success: true; output: string }
  | { success: false; error: string };

// ── SSE event types — shared between Route Handler (server) and page.tsx (client)

export type AgentEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string }
  | { type: "context_update"; messages: unknown[] }
  | { type: "done" }
  | { type: "error"; message: string }
  | { type: "plan"; goal: string; steps: PlanStep[] }
  | { type: "step_start"; stepId: string; description: string }
  | { type: "step_done"; stepId: string }
  | { type: "step_fail"; stepId: string; error: string; attempt: number }
  | { type: "reflect"; result: ReflectResult };

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
