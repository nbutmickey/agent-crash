// lib/conversations.ts
import type { Pool } from "pg";
import type { ConversationMeta, Conversation } from "./types";

type ConversationRow = {
  id: string;
  title: string;
  messages: unknown[];
  timeline: unknown[];
  created_at: string; // pg returns BIGINT as string
  updated_at: string;
};

function parseRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
    messages: row.messages,   // JSONB auto-deserialized by pg driver
    timeline: row.timeline,
  };
}

export async function listConversations(pool: Pool): Promise<ConversationMeta[]> {
  const result = await pool.query(
    "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  }));
}

export async function getConversation(pool: Pool, id: string): Promise<Conversation | undefined> {
  const result = await pool.query(
    "SELECT * FROM conversations WHERE id = $1",
    [id]
  );
  const row = result.rows[0] as ConversationRow | undefined;
  return row ? parseRow(row) : undefined;
}

export async function createConversation(pool: Pool): Promise<Conversation> {
  const id = crypto.randomUUID();
  const now = Date.now();
  await pool.query(
    "INSERT INTO conversations (id, title, messages, timeline, created_at, updated_at) VALUES ($1, $2, '[]', '[]', $3, $4)",
    [id, "New conversation", now, now]
  );
  return (await getConversation(pool, id))!;
}

export async function updateConversation(
  pool: Pool,
  id: string,
  patch: { title?: string; messages?: unknown[]; timeline?: unknown[] }
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.title !== undefined) {
    sets.push(`title = $${idx++}`);
    values.push(patch.title);
  }
  if (patch.messages !== undefined) {
    sets.push(`messages = $${idx++}`);
    values.push(JSON.stringify(patch.messages)); // pass as JSON string, pg stores as JSONB
  }
  if (patch.timeline !== undefined) {
    sets.push(`timeline = $${idx++}`);
    values.push(JSON.stringify(patch.timeline));
  }

  if (sets.length === 0) {
    // Empty patch — verify existence without modifying
    const result = await pool.query(
      "SELECT id FROM conversations WHERE id = $1",
      [id]
    );
    return result.rows.length > 0;
  }

  sets.push(`updated_at = $${idx++}`);
  values.push(Date.now());
  values.push(id); // WHERE id = $${idx}

  const result = await pool.query(
    `UPDATE conversations SET ${sets.join(", ")} WHERE id = $${idx}`,
    values
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteConversation(pool: Pool, id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM conversations WHERE id = $1",
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}
