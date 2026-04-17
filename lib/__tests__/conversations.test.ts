import Database from "better-sqlite3";
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
} from "../conversations";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE conversations (
      id         TEXT    PRIMARY KEY,
      title      TEXT    NOT NULL,
      messages   TEXT    NOT NULL DEFAULT '[]',
      timeline   TEXT    NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  return db;
}

describe("conversations CRUD", () => {
  let db: Database.Database;

  beforeEach(() => { db = makeDb(); });
  afterEach(() => { db.close(); });

  test("listConversations returns empty array initially", () => {
    expect(listConversations(db)).toEqual([]);
  });

  test("createConversation inserts a row with empty messages and timeline", () => {
    const conv = createConversation(db);
    expect(typeof conv.id).toBe("string");
    expect(conv.title).toBe("New conversation");
    expect(conv.messages).toEqual([]);
    expect(conv.timeline).toEqual([]);
    expect(typeof conv.created_at).toBe("number");
  });

  test("listConversations returns rows sorted by updated_at DESC", () => {
    db.prepare(
      "INSERT INTO conversations (id, title, messages, timeline, created_at, updated_at) VALUES (?, ?, '[]', '[]', ?, ?)"
    ).run("id-old", "Old", 1000, 1000);
    db.prepare(
      "INSERT INTO conversations (id, title, messages, timeline, created_at, updated_at) VALUES (?, ?, '[]', '[]', ?, ?)"
    ).run("id-new", "New", 2000, 2000);

    const list = listConversations(db);
    expect(list[0].id).toBe("id-new");
    expect(list[1].id).toBe("id-old");
    // Meta only — no messages or timeline
    expect((list[0] as Record<string, unknown>).messages).toBeUndefined();
  });

  test("getConversation returns undefined for unknown id", () => {
    expect(getConversation(db, "nope")).toBeUndefined();
  });

  test("getConversation returns full conversation with parsed JSON arrays", () => {
    const conv = createConversation(db);
    const loaded = getConversation(db, conv.id);
    expect(loaded).toBeDefined();
    expect(Array.isArray(loaded!.messages)).toBe(true);
    expect(Array.isArray(loaded!.timeline)).toBe(true);
  });

  test("updateConversation updates title", () => {
    const conv = createConversation(db);
    updateConversation(db, conv.id, { title: "Hello" });
    expect(getConversation(db, conv.id)!.title).toBe("Hello");
  });

  test("updateConversation updates messages as JSON", () => {
    const conv = createConversation(db);
    const msgs = [{ role: "user", content: "hi" }];
    updateConversation(db, conv.id, { messages: msgs });
    expect(getConversation(db, conv.id)!.messages).toEqual(msgs);
  });

  test("updateConversation updates timeline as JSON", () => {
    const conv = createConversation(db);
    const tl = [{ kind: "user", text: "hi" }];
    updateConversation(db, conv.id, { timeline: tl });
    expect(getConversation(db, conv.id)!.timeline).toEqual(tl);
  });

  test("updateConversation with empty patch does nothing", () => {
    const conv = createConversation(db);
    const before = getConversation(db, conv.id)!;
    updateConversation(db, conv.id, {});
    const after = getConversation(db, conv.id)!;
    expect(after.title).toBe(before.title);
  });

  test("deleteConversation removes the row", () => {
    const conv = createConversation(db);
    deleteConversation(db, conv.id);
    expect(getConversation(db, conv.id)).toBeUndefined();
    expect(listConversations(db)).toHaveLength(0);
  });

  test("deleteConversation returns false for unknown id", () => {
    const result = deleteConversation(db, "nonexistent");
    expect(result).toBe(false);
  });

  test("deleteConversation returns true when row exists", () => {
    const conv = createConversation(db);
    const result = deleteConversation(db, conv.id);
    expect(result).toBe(true);
  });

  test("updateConversation returns false for unknown id", () => {
    const result = updateConversation(db, "nonexistent", { title: "x" });
    expect(result).toBe(false);
  });

  test("updateConversation returns true when row exists", () => {
    const conv = createConversation(db);
    const result = updateConversation(db, conv.id, { title: "updated" });
    expect(result).toBe(true);
  });

  it("returns false for empty patch on nonexistent id", () => {
    expect(updateConversation(db, "ghost", {})).toBe(false);
  });
});
