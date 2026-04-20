import type { Tool } from "@mariozechner/pi-ai";
import type { RollbackStrategy } from "../types";
import type { ToolContext } from "./context";

export type ToolDefinition = {
  tool: Tool;
  rollbackStrategy: RollbackStrategy;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
  // snapshot 策略：执行前捕获，返回还原函数
  captureRollback?: (args: Record<string, unknown>, ctx: ToolContext) => Promise<() => Promise<void>>;
  // saga 策略：执行前捕获，返回补偿函数
  captureSaga?: (args: Record<string, unknown>, ctx: ToolContext) => Promise<() => Promise<string>>;
};

export class ToolRegistry {
  private definitions = new Map<string, ToolDefinition>();

  register(def: ToolDefinition): this {
    this.definitions.set(def.tool.name, def);
    return this;
  }

  unregister(name: string): this {
    this.definitions.delete(name);
    return this;
  }

  has(name: string): boolean {
    return this.definitions.has(name);
  }

  getTools(): Tool[] {
    return [...this.definitions.values()].map((d) => d.tool);
  }

  getDefinition(name: string): ToolDefinition | undefined {
    return this.definitions.get(name);
  }
}
