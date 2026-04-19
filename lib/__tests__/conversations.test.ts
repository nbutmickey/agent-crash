import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
} from "../conversations";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for tests. Set it in .env.local");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT    PRIMARY KEY,
      title      TEXT    NOT NULL,
      messages   JSONB   NOT NULL DEFAULT '[]',
      timeline   JSONB   NOT NULL DEFAULT '[]',
      created_at BIGINT  NOT NULL,
      updated_at BIGINT  NOT NULL
    )
  `);
});

afterEach(async () => {
  await pool.query("DELETE FROM conversations");
});

afterAll(async () => {
  await pool.end();
});

describe("conversations CRUD", () => {
  test("listConversations returns empty array initially", async () => {
    expect(await listConversations(pool)).toEqual([]);
  });

  test("createConversation inserts a row with empty messages and timeline", async () => {
    const conv = await createConversation(pool);
    expect(typeof conv.id).toBe("string");
    expect(conv.title).toBe("New conversation");
    expect(conv.messages).toEqual([]);
    expect(conv.timeline).toEqual([]);
    expect(typeof conv.created_at).toBe("number");
  });

  test("listConversations returns rows sorted by updated_at DESC", async () => {
    await pool.query(
      "INSERT INTO conversations (id, title, messages, timeline, created_at, updated_at) VALUES ($1, $2, '[]', '[]', $3, $4)",
      ["id-old", "Old", 1000, 1000]
    );
    await pool.query(
      "INSERT INTO conversations (id, title, messages, timeline, created_at, updated_at) VALUES ($1, $2, '[]', '[]', $3, $4)",
      ["id-new", "New", 2000, 2000]
    );

    const list = await listConversations(pool);
    expect(list[0].id).toBe("id-new");
    expect(list[1].id).toBe("id-old");
    // Meta only — no messages or timeline
    expect((list[0] as Record<string, unknown>).messages).toBeUndefined();
  });

  test("getConversation returns undefined for unknown id", async () => {
    expect(await getConversation(pool, "nope")).toBeUndefined();
  });

  test("getConversation returns full conversation with parsed JSON arrays", async () => {
    const conv = await createConversation(pool);
    const loaded = await getConversation(pool, conv.id);
    expect(loaded).toBeDefined();
    expect(Array.isArray(loaded!.messages)).toBe(true);
    expect(Array.isArray(loaded!.timeline)).toBe(true);
  });

  test("updateConversation updates title", async () => {
    const conv = await createConversation(pool);
    await updateConversation(pool, conv.id, { title: "Hello" });
    expect((await getConversation(pool, conv.id))!.title).toBe("Hello");
  });

  test("updateConversation updates messages as JSON", async () => {
    const conv = await createConversation(pool);
    const msgs = [{ role: "user", content: "hi" }];
    await updateConversation(pool, conv.id, { messages: msgs });
    expect((await getConversation(pool, conv.id))!.messages).toEqual(msgs);
  });

  test("updateConversation updates timeline as JSON", async () => {
    const conv = await createConversation(pool);
    const tl = [{ kind: "user", text: "hi" }];
    await updateConversation(pool, conv.id, { timeline: tl });
    expect((await getConversation(pool, conv.id))!.timeline).toEqual(tl);
  });

  test("updateConversation with empty patch does nothing", async () => {
    const conv = await createConversation(pool);
    const before = (await getConversation(pool, conv.id))!;
    await updateConversation(pool, conv.id, {});
    const after = (await getConversation(pool, conv.id))!;
    expect(after.title).toBe(before.title);
  });

  test("deleteConversation removes the row", async () => {
    const conv = await createConversation(pool);
    await deleteConversation(pool, conv.id);
    expect(await getConversation(pool, conv.id)).toBeUndefined();
    expect(await listConversations(pool)).toHaveLength(0);
  });

  test("deleteConversation returns false for unknown id", async () => {
    const result = await deleteConversation(pool, "nonexistent");
    expect(result).toBe(false);
  });

  test("deleteConversation returns true when row exists", async () => {
    const conv = await createConversation(pool);
    const result = await deleteConversation(pool, conv.id);
    expect(result).toBe(true);
  });

  test("updateConversation returns false for unknown id", async () => {
    const result = await updateConversation(pool, "nonexistent", { title: "x" });
    expect(result).toBe(false);
  });

  test("updateConversation returns true when row exists", async () => {
    const conv = await createConversation(pool);
    const result = await updateConversation(pool, conv.id, { title: "updated" });
    expect(result).toBe(true);
  });

  it("returns false for empty patch on nonexistent id", async () => {
    expect(await updateConversation(pool, "ghost", {})).toBe(false);
  });
});
