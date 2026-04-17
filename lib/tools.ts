import { Type } from "@mariozechner/pi-ai";
import type { Tool, ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

function sandboxPath(p: string): string {
  const resolved = path.resolve(ROOT, p);
  if (!resolved.startsWith(ROOT)) {
    throw new Error(`Path "${p}" is outside project root`);
  }
  return resolved;
}

type TodoStatus = "pending" | "in_progress" | "completed";
type Todo = { id: number; content: string; status: TodoStatus };

/**
 * Factory — call once per agent-loop request so TodoWrite state is per-conversation.
 */
export function createTools() {
  const todos: Todo[] = [];

  const TOOLS: Tool[] = [
    // ── File reading ──────────────────────────────────────────────
    {
      name: "read",
      description: "Read the full content of a file. Path is relative to project root.",
      parameters: Type.Object({
        path: Type.String({ description: "File path relative to project root" }),
      }),
    },
    {
      name: "grep",
      description:
        "Search for a regex pattern across files. Returns matching lines with line numbers.",
      parameters: Type.Object({
        pattern: Type.String({ description: "Regex pattern to search for" }),
        path: Type.String({
          description: "File or directory to search in (relative to project root)",
        }),
        case_insensitive: Type.Optional(
          Type.Boolean({ description: "Case-insensitive search (default: false)" })
        ),
      }),
    },
    {
      name: "glob",
      description:
        "Find files matching a glob pattern. Returns a list of matching file paths.",
      parameters: Type.Object({
        pattern: Type.String({
          description: 'Glob pattern, e.g. "**/*.ts" or "demo/*.txt"',
        }),
      }),
    },

    // ── Shell ─────────────────────────────────────────────────────
    {
      name: "bash",
      description:
        "Execute a shell command in the project root directory. Timeout: 15s.",
      parameters: Type.Object({
        command: Type.String({ description: "Shell command to execute" }),
      }),
    },

    // ── File writing ──────────────────────────────────────────────
    {
      name: "write",
      description:
        "Write content to a file (creates or overwrites). Path is relative to project root.",
      parameters: Type.Object({
        path: Type.String({ description: "File path relative to project root" }),
        content: Type.String({ description: "Content to write" }),
      }),
    },
    {
      name: "edit",
      description:
        "Replace an exact string in a file. Fails if old_string is not found.",
      parameters: Type.Object({
        path: Type.String({ description: "File path relative to project root" }),
        old_string: Type.String({ description: "Exact string to find and replace" }),
        new_string: Type.String({ description: "Replacement string" }),
      }),
    },

    // ── Task tracking ─────────────────────────────────────────────
    {
      name: "TodoWrite",
      description:
        "Create and update the task list. Always pass the COMPLETE list of todos — this replaces the previous list entirely.",
      parameters: Type.Object({
        todos: Type.Array(
          Type.Object({
            content: Type.String({ description: "Task description" }),
            status: Type.Union([
              Type.Literal("pending"),
              Type.Literal("in_progress"),
              Type.Literal("completed"),
            ]),
          })
        ),
      }),
    },

    // ── Web ───────────────────────────────────────────────────────
    {
      name: "webSearch",
      description:
        "Search the web. Returns top results with title, URL, and content. Set TAVILY_API_KEY in .env.local for real results.",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
      }),
    },
    {
      name: "webFetch",
      description:
        "Fetch the text content of a URL (HTML tags stripped). Returns up to 5000 characters.",
      parameters: Type.Object({
        url: Type.String({ description: "URL to fetch" }),
      }),
    },
  ];

  async function executeTool(toolCall: ToolCall): Promise<string> {
    const args = toolCall.arguments;

    switch (toolCall.name) {
      // ── read ────────────────────────────────────────────────────
      case "read": {
        try {
          const full = sandboxPath(args.path as string);
          return fs.readFileSync(full, "utf-8");
        } catch (e) {
          return `Error: ${e}`;
        }
      }

      // ── grep ────────────────────────────────────────────────────
      case "grep": {
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
      }

      // ── glob ────────────────────────────────────────────────────
      case "glob": {
        try {
          const result = execSync(
            `find . -path ${JSON.stringify(`./${args.pattern as string}`)} ` +
              `-not -path "*/node_modules/*" ` +
              `-not -path "*/.next/*" ` +
              `-not -path "*/.git/*"`,
            { cwd: ROOT, timeout: 10000, encoding: "utf-8" }
          );
          return result.trim() || "(no files found)";
        } catch (e: any) {
          return `Error: ${e.message}`;
        }
      }

      // ── bash ────────────────────────────────────────────────────
      case "bash": {
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
      }

      // ── write ───────────────────────────────────────────────────
      case "write": {
        try {
          const full = sandboxPath(args.path as string);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.writeFileSync(full, args.content as string, "utf-8");
          return `Written: ${args.path}`;
        } catch (e) {
          return `Error: ${e}`;
        }
      }

      // ── edit ────────────────────────────────────────────────────
      case "edit": {
        try {
          const full = sandboxPath(args.path as string);
          const content = fs.readFileSync(full, "utf-8");
          const oldStr = args.old_string as string;
          if (!content.includes(oldStr)) {
            return `Error: old_string not found in "${args.path}"`;
          }
          fs.writeFileSync(
            full,
            content.replace(oldStr, args.new_string as string),
            "utf-8"
          );
          return `Edited: ${args.path}`;
        } catch (e) {
          return `Error: ${e}`;
        }
      }

      // ── TodoWrite ────────────────────────────────────────────────
      case "TodoWrite": {
        const incoming = args.todos as Array<{ content: string; status: string }>;
        todos.length = 0;
        incoming.forEach((t, i) => {
          todos.push({ id: i + 1, content: t.content, status: t.status as TodoStatus });
        });
        const icon: Record<TodoStatus, string> = {
          pending: "⬜",
          in_progress: "🔄",
          completed: "✅",
        };
        const lines = todos.map((t) => `${icon[t.status]} [${t.status}] ${t.content}`);
        return `Todo list updated (${todos.length} items):\n${lines.join("\n")}`;
      }

      // ── webSearch ────────────────────────────────────────────────
      case "webSearch": {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          return (
            `[mock — add TAVILY_API_KEY to .env.local for real results]\n` +
            `Query: "${args.query as string}"\n\n` +
            `1. Mock Result A — example.com\n   A snippet about "${args.query}"\n\n` +
            `2. Mock Result B — docs.example.com\n   More information about "${args.query}"\n\n` +
            `3. Mock Result C — blog.example.com\n   An article discussing "${args.query}"`
          );
        }
        try {
          const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: apiKey,
              query: args.query,
              search_depth: "basic",
              max_results: 5,
            }),
          });
          const data = (await res.json()) as {
            results?: Array<{ title: string; url: string; content: string }>;
          };
          const results = (data.results ?? [])
            .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}`)
            .join("\n\n");
          return results || "(no results)";
        } catch (e) {
          return `Error: ${e}`;
        }
      }

      // ── webFetch ─────────────────────────────────────────────────
      case "webFetch": {
        try {
          const res = await fetch(args.url as string, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentLoopDemo/1.0)" },
            signal: AbortSignal.timeout(15000),
          });
          const html = await res.text();
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 5000);
          return text || "(empty response)";
        } catch (e) {
          return `Error: ${e}`;
        }
      }

      default:
        return `Error: unknown tool "${toolCall.name}"`;
    }
  }

  return { TOOLS, executeTool, todos };
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
