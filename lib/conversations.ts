// data-agent/packages/agent-loop/lib/conversations.ts
import type { Database } from "better-sqlite3";
import type { ConversationMeta, Conversation } from "./types";

type ConversationRow = {
  id: string;
  title: string;
  messages: string;
  timeline: string;
  created_at: number;
  updated_at: number;
};

function parseRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
    messages: JSON.parse(row.messages),
    timeline: JSON.parse(row.timeline),
  };
}

export function listConversations(db: Database): ConversationMeta[] {
  return db
    .prepare(
      "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
    )
    .all() as ConversationMeta[];
}

export function getConversation(db: Database, id: string): Conversation | undefined {
  const row = db
    .prepare("SELECT * FROM conversations WHERE id = ?")
    .get(id) as ConversationRow | undefined;
  return row ? parseRow(row) : undefined;
}

export function createConversation(db: Database): Conversation {
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    "INSERT INTO conversations (id, title, messages, timeline, created_at, updated_at) VALUES (?, ?, '[]', '[]', ?, ?)"
  ).run(id, "New conversation", now, now);
  return getConversation(db, id)!;
}

export function updateConversation(
  db: Database,
  id: string,
  patch: { title?: string; messages?: unknown[]; timeline?: unknown[] }
): boolean {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    values.push(patch.title);
  }
  if (patch.messages !== undefined) {
    sets.push("messages = ?");
    values.push(JSON.stringify(patch.messages));
  }
  if (patch.timeline !== undefined) {
    sets.push("timeline = ?");
    values.push(JSON.stringify(patch.timeline));
  }
  if (sets.length === 0) {
    // Empty patch — verify existence without modifying
    const row = db.prepare("SELECT id FROM conversations WHERE id = ?").get(id);
    return row !== undefined;
  }
  sets.push("updated_at = ?");
  values.push(Date.now());
  values.push(id);
  const result = db.prepare(`UPDATE conversations SET ${sets.join(", ")} WHERE id = ?`).run(...values);
  return result.changes > 0;
}

export function deleteConversation(db: Database, id: string): boolean {
  const result = db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  return result.changes > 0;
}
