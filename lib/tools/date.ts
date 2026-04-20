import { Type } from "@mariozechner/pi-ai";
import type { ToolRegistry } from "./registry";

export function registerDateTools(registry: ToolRegistry): void {
  registry.register({
    tool: {
      name: "getDate",
      description: "获取当前日期和时间（ISO 8601 格式）。需要知道今天日期时调用。",
      parameters: Type.Object({}),
    },
    rollbackStrategy: "none",
    execute: async () => new Date().toISOString(),
  });
}
