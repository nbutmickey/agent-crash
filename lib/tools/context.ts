import type { RollbackManager } from "../rollback";

export type TodoStatus = "pending" | "in_progress" | "completed";
export type Todo = { id: number; content: string; status: TodoStatus };

export type ToolContext = {
  readFiles: Set<string>;
  todos: Todo[];
  rollbackManager: RollbackManager;
};
