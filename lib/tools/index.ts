import type { ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import { RollbackManager } from "../rollback";
import { runPreHooks } from "../hooks/pre";
import { runPostHooks } from "../hooks/post";
import { ToolRegistry } from "./registry";
import { ToolContext } from "./context";
import { registerFileTools } from "./file";
import { registerShellTools } from "./shell";
import { registerTodoTools } from "./todo";
import { registerDateTools } from "./date";
import { registerWebTools } from "./web";
import { registerRollbackTool } from "./rollback-tool";

export function createTools() {
  const ctx: ToolContext = {
    readFiles: new Set(),
    todos: [],
    rollbackManager: new RollbackManager(),
  };

  const registry = new ToolRegistry();
  registerFileTools(registry, ctx);
  registerShellTools(registry);
  registerTodoTools(registry, ctx);
  registerDateTools(registry);
  registerWebTools(registry);
  registerRollbackTool(registry, ctx);

  const TOOLS = registry.getTools();

  async function executeTool(toolCall: ToolCall): Promise<string> {
    const args = toolCall.arguments as Record<string, unknown>;

    // 1. Pre-hooks
    const preResult = runPreHooks(toolCall.name, args, ctx);
    if (!preResult.allowed) return `[BLOCKED] ${preResult.reason}`;

    const def = registry.getDefinition(toolCall.name);
    if (!def) return `Error: unknown tool "${toolCall.name}"`;

    // 2. Capture snapshot (rollback 工具自身跳过，避免循环)
    let rollback: (() => Promise<void>) | null = null;
    let sagaCompensation: (() => Promise<string>) | null = null;

    if (toolCall.name !== "rollback") {
      if (def.rollbackStrategy === "snapshot" && def.captureRollback) {
        rollback = await def.captureRollback(args, ctx);
      } else if (def.rollbackStrategy === "saga" && def.captureSaga) {
        sagaCompensation = await def.captureSaga(args, ctx);
      }
    }

    // 3. Execute
    const rawResult = await def.execute(args, ctx);

    // 4. Post-hooks
    const result = await runPostHooks(toolCall.name, args, rawResult);

    // 5. Record to rollback history
    if (def.rollbackStrategy !== "none" && toolCall.name !== "rollback") {
      ctx.rollbackManager.record({
        id: `${toolCall.name}-${Date.now()}`,
        toolName: toolCall.name,
        args,
        result,
        timestamp: new Date().toISOString(),
        strategy: def.rollbackStrategy,
        rollback,
        sagaCompensation,
      });
    }

    return result;
  }

  return { TOOLS, executeTool, ctx };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

export function makeToolResultMessage(
  toolCall: ToolCall,
  result: string,
  isError = false
): ToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text: result }],
    isError,
    timestamp: Date.now(),
  };
}

export function extractToolCalls(
  content: Array<{ type: string; [key: string]: unknown }>
): ToolCall[] {
  return content.filter((c): c is ToolCall => c.type === "toolCall");
}
