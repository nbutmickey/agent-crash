import { Type } from "@mariozechner/pi-ai";
import { execSync } from "node:child_process";
import { ROOT } from "./sandbox";
import { snapshotHealthData, createSagaCompensation } from "../rollback";
import type { ToolRegistry } from "./registry";

export function registerShellTools(registry: ToolRegistry): void {
  registry.register({
    tool: {
      name: "bash",
      description: "Execute a shell command in the project root directory. Timeout: 15s.",
      parameters: Type.Object({
        command: Type.String({ description: "Shell command to execute" }),
      }),
    },
    rollbackStrategy: "saga",
    captureSaga: async () => {
      const before = snapshotHealthData();
      return createSagaCompensation(before);
    },
    execute: async (args) => {
      try {
        const result = execSync(args.command as string, {
          cwd: ROOT,
          timeout: 15000,
          encoding: "utf-8",
        });
        return result || "(no output)";
      } catch (e: any) {
        return `Exit ${e.status ?? 1}:\n${e.stderr || e.message}`;
      }
    },
  });
}
