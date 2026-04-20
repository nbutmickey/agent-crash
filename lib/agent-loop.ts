import type { Message } from "@mariozechner/pi-ai";
import { emit } from "./sse";
import { createTools } from "./tools/index";
import { planPhase } from "./phases/plan";
import { executeStep } from "./phases/execute";
import { reflectPhase } from "./phases/reflect";
import type { PlanContext, ReactGuard } from "./types";

const MAX_PLAN_ATTEMPTS = 3;
const MAX_REACT_ITERATIONS = 5;
const TOOL_TIMEOUT_MS = 30_000;

export async function runAgentLoop(
  messages: Message[],
  controller: ReadableStreamDefaultController
): Promise<void> {
  const { TOOLS, executeTool } = createTools();
  const planContext: PlanContext = { previousFailures: [] };

  for (let attempt = 0; attempt < MAX_PLAN_ATTEMPTS; attempt++) {
    // ── PLAN ──────────────────────────────────────────────────────
    const plan = await planPhase(messages, planContext, controller);

    if (plan.can_answer_directly) {
      for (const char of plan.direct_answer ?? "") {
        emit(controller, { type: "text_delta", delta: char });
      }
      emit(controller, { type: "done" });
      return;
    }

    // ── EXECUTE ───────────────────────────────────────────────────
    const completedOutputs: string[] = [];
    let failed = false;

    for (const step of plan.steps) {
      emit(controller, { type: "step_start", stepId: step.id, description: step.description });

      const guard: ReactGuard = {
        maxIterations: MAX_REACT_ITERATIONS,
        toolTimeoutMs: TOOL_TIMEOUT_MS,
        seenCalls: new Set(),
      };

      const result = await executeStep(step, messages, guard, executeTool, controller);

      if (result.success) {
        step.status = "done";
        completedOutputs.push(result.output);
        emit(controller, { type: "step_done", stepId: step.id });
      } else {
        step.status = "failed";
        step.error = result.error;
        failed = true;

        emit(controller, { type: "step_fail", stepId: step.id, error: result.error, attempt: attempt + 1 });

        planContext.previousFailures.push({
          stepDescription: step.description,
          error: result.error,
          completedSteps: plan.steps.filter((s) => s.status === "done").map((s) => s.id),
        });
        break; // 步骤失败 → 回 PLAN
      }
    }

    if (failed) continue;

    // ── REFLECT（所有步骤完成时触发一次）─────────────────────────
    const reflectResult = await reflectPhase(messages, plan, completedOutputs, controller);

    if (reflectResult.decision === "done") {
      if (reflectResult.summary) {
        emit(controller, { type: "text_delta", delta: `\n\n${reflectResult.summary}` });
      }
      emit(controller, { type: "context_update", messages: messages as unknown[] });
      emit(controller, { type: "done" });
      return;
    }

    planContext.previousFailures.push({
      stepDescription: "整体质量评估未通过",
      error: reflectResult.summary,
      completedSteps: plan.steps.map((s) => s.id),
    });
  }

  // ── GRACEFUL EXIT ──────────────────────────────────────────────
  const failures = planContext.previousFailures;
  const message =
    `抱歉，我尝试了 ${failures.length} 次但未能完成任务。\n\n` +
    `遇到的问题：\n${failures.map((f, i) => `${i + 1}. ${f.stepDescription}：${f.error}`).join("\n")}\n\n` +
    `建议你描述得更具体，或将任务拆分为更小的步骤后重试。`;

  for (const char of message) {
    emit(controller, { type: "text_delta", delta: char });
  }
  emit(controller, { type: "context_update", messages: messages as unknown[] });
  emit(controller, { type: "done" });
}
