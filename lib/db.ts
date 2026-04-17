// data-agent/packages/agent-loop/lib/db.ts
import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data.db");

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT    PRIMARY KEY,
    title      TEXT    NOT NULL,
    messages   TEXT    NOT NULL DEFAULT '[]',
    timeline   TEXT    NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

export default db;
