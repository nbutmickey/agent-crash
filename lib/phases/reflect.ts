import { stream } from "@mariozechner/pi-ai";
import type { Message } from "@mariozechner/pi-ai";
import { model } from "../model";
import { emit } from "../sse";
import { REFLECT_SYSTEM_PROMPT } from "../prompts";
import type { Plan, ReflectResult } from "../types";

function parseJSON<T>(raw: string): T | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

const FALLBACK_REFLECT: ReflectResult = { goal_achieved: true, summary: "执行完成", decision: "done" };

export async function reflectPhase(
  messages: Message[],
  plan: Plan,
  completedOutputs: string[],
  controller: ReadableStreamDefaultController
): Promise<ReflectResult> {
  const summary =
    `目标：${plan.goal}\n` +
    `完成步骤：${plan.steps.filter((s) => s.status === "done").length}/${plan.steps.length}\n` +
    `执行摘要：${completedOutputs.slice(-3).join(" | ")}`;

  const context = {
    systemPrompt: REFLECT_SYSTEM_PROMPT,
    messages: [
      ...messages,
      { role: "user", content: `请评估本次执行结果。\n\n${summary}`, timestamp: Date.now() } as Message,
    ],
    tools: [],
  };

  const eventStream = stream(model, context);
  let raw = "";
  for await (const event of eventStream) {
    if (event.type === "text_delta") raw += event.delta;
  }

  const result: ReflectResult = parseJSON<ReflectResult>(raw) ?? FALLBACK_REFLECT;
  emit(controller, { type: "reflect", result });
  return result;
}
