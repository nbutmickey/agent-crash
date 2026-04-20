import { Type } from "@mariozechner/pi-ai";
import type { ToolRegistry } from "./registry";
import type { ToolContext, TodoStatus } from "./context";

export function registerTodoTools(registry: ToolRegistry, ctx: ToolContext): void {
  registry.register({
    tool: {
      name: "TodoWrite",
      description: "Create and update the task list. Always pass the COMPLETE list of todos — this replaces the previous list entirely.",
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
    rollbackStrategy: "snapshot",
    captureRollback: async () => {
      const previousTodos = ctx.todos.map((t) => ({ ...t }));
      return async () => {
        ctx.todos.length = 0;
        previousTodos.forEach((t) => ctx.todos.push(t));
      };
    },
    execute: async (args) => {
      const incoming = args.todos as Array<{ content: string; status: string }>;
      ctx.todos.length = 0;
      incoming.forEach((t, i) => {
        ctx.todos.push({ id: i + 1, content: t.content, status: t.status as TodoStatus });
      });
      const icon: Record<TodoStatus, string> = { pending: "⬜", in_progress: "🔄", completed: "✅" };
      const lines = ctx.todos.map((t) => `${icon[t.status]} [${t.status}] ${t.content}`);
      return `Todo list updated (${ctx.todos.length} items):\n${lines.join("\n")}`;
    },
  });
}
