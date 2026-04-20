import { Type } from "@mariozechner/pi-ai";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { ROOT, sandboxPath } from "./sandbox";
import type { ToolRegistry } from "./registry";
import type { ToolContext } from "./context";

export function registerFileTools(registry: ToolRegistry, ctx: ToolContext): void {
  registry.register({
    tool: {
      name: "read",
      description: "Read the full content of a file. Path is relative to project root.",
      parameters: Type.Object({
        path: Type.String({ description: "File path relative to project root" }),
      }),
    },
    rollbackStrategy: "none",
    execute: async (args) => {
      try {
        const full = sandboxPath(args.path as string);
        const content = fs.readFileSync(full, "utf-8");
        ctx.readFiles.add(args.path as string);
        return content;
      } catch (e) {
        return `Error: ${e}`;
      }
    },
  });

  registry.register({
    tool: {
      name: "grep",
      description: "Search for a regex pattern across files. Returns matching lines with line numbers.",
      parameters: Type.Object({
        pattern: Type.String({ description: "Regex pattern to search for" }),
        path: Type.String({ description: "File or directory to search in (relative to project root)" }),
        case_insensitive: Type.Optional(Type.Boolean({ description: "Case-insensitive search (default: false)" })),
      }),
    },
    rollbackStrategy: "none",
    execute: async (args) => {
      try {
        const target = sandboxPath(args.path as string);
        const ci = args.case_insensitive ? "-i" : "";
        const flags = ["-r", "-n", ci].filter(Boolean).join(" ");
        const result = execSync(
          `grep ${flags} ${JSON.stringify(args.pattern as string)} ${JSON.stringify(target)}`,
          { cwd: ROOT, timeout: 10000, encoding: "utf-8" }
        );
        return result.trim() || "(no matches)";
      } catch (e: any) {
        if (e.status === 1) return "(no matches)";
        return `Error: ${e.message}`;
      }
    },
  });

  registry.register({
    tool: {
      name: "glob",
      description: "Find files matching a glob pattern. Returns a list of matching file paths.",
      parameters: Type.Object({
        pattern: Type.String({ description: 'Glob pattern, e.g. "**/*.ts" or "demo/*.txt"' }),
      }),
    },
    rollbackStrategy: "none",
    execute: async (args) => {
      try {
        const result = execSync(
          `find . -path ${JSON.stringify(`./${args.pattern as string}`)} ` +
            `-not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*"`,
          { cwd: ROOT, timeout: 10000, encoding: "utf-8" }
        );
        return result.trim() || "(no files found)";
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    },
  });

  registry.register({
    tool: {
      name: "write",
      description: "Write content to a file (creates or overwrites). Path is relative to project root.",
      parameters: Type.Object({
        path: Type.String({ description: "File path relative to project root" }),
        content: Type.String({ description: "Content to write" }),
      }),
    },
    rollbackStrategy: "snapshot",
    captureRollback: async (args) => {
      const full = sandboxPath(args.path as string);
      if (fs.existsSync(full)) {
        const prev = fs.readFileSync(full, "utf-8");
        return async () => fs.writeFileSync(full, prev, "utf-8");
      }
      return async () => { if (fs.existsSync(full)) fs.unlinkSync(full); };
    },
    execute: async (args) => {
      try {
        const full = sandboxPath(args.path as string);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, args.content as string, "utf-8");
        ctx.readFiles.add(args.path as string);
        return `Written: ${args.path}`;
      } catch (e) {
        return `Error: ${e}`;
      }
    },
  });

  registry.register({
    tool: {
      name: "edit",
      description: "Replace an exact string in a file. Fails if old_string is not found.",
      parameters: Type.Object({
        path: Type.String({ description: "File path relative to project root" }),
        old_string: Type.String({ description: "Exact string to find and replace" }),
        new_string: Type.String({ description: "Replacement string" }),
      }),
    },
    rollbackStrategy: "snapshot",
    captureRollback: async (args) => {
      const full = sandboxPath(args.path as string);
      if (fs.existsSync(full)) {
        const prev = fs.readFileSync(full, "utf-8");
        return async () => fs.writeFileSync(full, prev, "utf-8");
      }
      return async () => {};
    },
    execute: async (args) => {
      try {
        const full = sandboxPath(args.path as string);
        const content = fs.readFileSync(full, "utf-8");
        const oldStr = args.old_string as string;
        if (!content.includes(oldStr)) return `Error: old_string not found in "${args.path}"`;
        fs.writeFileSync(full, content.replace(oldStr, args.new_string as string), "utf-8");
        return `Edited: ${args.path}`;
      } catch (e) {
        return `Error: ${e}`;
      }
    },
  });
}
