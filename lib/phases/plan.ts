import { stream } from "@mariozechner/pi-ai";
import type { Message } from "@mariozechner/pi-ai";
import { model } from "../model";
import { emit } from "../sse";
import { PLAN_SYSTEM_PROMPT } from "../prompts";
import type { Plan, PlanContext } from "../types";

function parseJSON<T>(raw: string): T | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

const FALLBACK_PLAN: Plan = {
  can_answer_directly: false,
  goal: "完成用户请求",
  steps: [{
    id: "step-1",
    description: "根据用户请求执行相应操作",
    tool_hints: [],
    success_criteria: "用户请求得到响应",
    status: "pending",
  }],
};

export async function planPhase(
  messages: Message[],
  planContext: PlanContext,
  controller: ReadableStreamDefaultController
): Promise<Plan> {
  const contextNote = planContext.previousFailures.length > 0
    ? `\n\n历史失败记录：\n${planContext.previousFailures.map(
        (f) => `- 步骤"${f.stepDescription}"失败，原因：${f.error}，已完成：${f.completedSteps.join(", ") || "无"}`
      ).join("\n")}`
    : "";

  const context = {
    systemPrompt: PLAN_SYSTEM_PROMPT,
    messages: [
      ...messages,
      { role: "user", content: `请为上述用户请求生成执行计划。${contextNote}`, timestamp: Date.now() } as Message,
    ],
    tools: [],
  };

  const eventStream = stream(model, context);
  let raw = "";
  for await (const event of eventStream) {
    if (event.type === "text_delta") raw += event.delta;
  }

  const plan: Plan = parseJSON<Plan>(raw) ?? FALLBACK_PLAN;
  plan.steps = plan.steps.map((s) => ({ ...s, status: "pending" as const }));

  if (!plan.can_answer_directly) {
    emit(controller, { type: "plan", goal: plan.goal, steps: plan.steps });
  }

  return plan;
}
