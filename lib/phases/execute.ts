import { stream } from "@mariozechner/pi-ai";
import type { Message, ToolCall } from "@mariozechner/pi-ai";
import { model } from "../model";
import { emit } from "../sse";
import { EXECUTE_SYSTEM_PROMPT } from "../prompts";
import { makeToolResultMessage, extractToolCalls } from "../tools/index";
import type { PlanStep, ReactGuard, StepResult } from "../types";

function stableHash(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

function extractText(content: Array<{ type: string; [k: string]: unknown }>): string {
  return content.filter((c) => c.type === "text").map((c) => c.text as string).join("");
}

export async function executeStep(
  step: PlanStep,
  messages: Message[],
  guard: ReactGuard,
  executeTool: (tc: ToolCall) => Promise<string>,
  controller: ReadableStreamDefaultController
): Promise<StepResult> {
  const stepContext = {
    systemPrompt: EXECUTE_SYSTEM_PROMPT,
    messages: [
      ...messages,
      {
        role: "user",
        content:
          `【当前步骤】${step.description}\n` +
          `【成功标准】${step.success_criteria}\n` +
          `【工具提示】${step.tool_hints.join(", ") || "按需选择"}`,
        timestamp: Date.now(),
      } as Message,
    ],
  };

  let iterations = 0;

  while (iterations < guard.maxIterations) {
    const eventStream = stream(model, stepContext as any);
    let stepOutput = "";

    for await (const event of eventStream) {
      if (event.type === "text_delta") {
        stepOutput += event.delta;
        emit(controller, { type: "text_delta", delta: event.delta });
      }
    }

    const response = await eventStream.result();
    stepContext.messages.push(response);

    if (response.stopReason === "stop" || response.stopReason === "length") {
      return { success: true, output: stepOutput || extractText(response.content as any) };
    }

    if (response.stopReason === "error" || response.stopReason === "aborted") {
      return { success: false, error: `LLM 异常退出：${response.stopReason}` };
    }

    if (response.stopReason === "toolUse") {
      const toolCalls = extractToolCalls(response.content as any);

      for (const toolCall of toolCalls) {
        // ── 重复调用检测 ───────────────────────────────────────────
        const key = `${toolCall.name}:${stableHash(toolCall.arguments)}`;
        if (guard.seenCalls.has(key)) {
          return { success: false, error: `重复调用检测：工具 ${toolCall.name} 使用相同参数被调用两次，已中止` };
        }
        guard.seenCalls.add(key);

        // ── 工具超时 ──────────────────────────────────────────────
        let result: string;
        try {
          result = await Promise.race([
            executeTool(toolCall),
            rejectAfter(guard.toolTimeoutMs, `工具 ${toolCall.name} 执行超时（${guard.toolTimeoutMs}ms）`),
          ]);
        } catch (e) {
          return { success: false, error: String(e) };
        }

        emit(controller, { type: "tool_call", name: toolCall.name, args: toolCall.arguments as Record<string, unknown> });
        emit(controller, { type: "tool_result", name: toolCall.name, result });
        stepContext.messages.push(makeToolResultMessage(toolCall, result));
      }
    }

    iterations++;
  }

  return { success: false, error: `步骤超过最大迭代次数（${guard.maxIterations}），可能陷入循环` };
}
