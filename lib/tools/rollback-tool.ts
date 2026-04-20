import { Type } from "@mariozechner/pi-ai";
import type { ToolRegistry } from "./registry";
import type { ToolContext } from "./context";

export function registerRollbackTool(registry: ToolRegistry, ctx: ToolContext): void {
  registry.register({
    tool: {
      name: "rollback",
      description: "回滚最近工具调用的效果。可逆操作精确还原，不可逆操作（bash）执行 SAGA 补偿。",
      parameters: Type.Object({
        steps: Type.Optional(Type.Number({ description: "回滚步数，默认 1；传 -1 回滚全部历史" })),
      }),
    },
    rollbackStrategy: "none", // rollback 自身不被记录，避免循环
    execute: async (args) => {
      const steps = (args.steps as number) ?? 1;
      const results = steps === -1
        ? await ctx.rollbackManager.rollbackAll()
        : await ctx.rollbackManager.rollbackLast(steps);
      return results.join("\n") || "无可回滚的操作";
    },
  });
}
