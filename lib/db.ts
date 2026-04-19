// lib/db.ts
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL.includes("localhost") ||
    process.env.DATABASE_URL.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false },
});

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

export default pool;
