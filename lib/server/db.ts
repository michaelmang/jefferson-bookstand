import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

/**
 * Deletes cascade explicitly in the actions (not via ON DELETE) so behavior
 * doesn't depend on the foreign_keys pragma of the hosting database.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    picture TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS stands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    posted_at INTEGER NOT NULL,
    background TEXT NOT NULL DEFAULT 'library',
    audio_json TEXT
  );
  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stand_id INTEGER NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    title TEXT NOT NULL,
    pdf_path TEXT NOT NULL,
    UNIQUE(stand_id, idx)
  );
  CREATE TABLE IF NOT EXISTS stand_stamps (
    stand_id INTEGER NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (stand_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS slot_stamps (
    slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    PRIMARY KEY (slot_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stand_id INTEGER NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_stands_posted ON stands(posted_at);
  CREATE INDEX IF NOT EXISTS idx_letters_stand ON letters(stand_id);
`;

// Survive dev-server module reloads with a single connection. libSQL talks
// to a local SQLite file in development and to Turso (DATABASE_URL +
// DATABASE_AUTH_TOKEN) in production — Vercel's filesystem is ephemeral.
const globalForDb = globalThis as unknown as { __bookstandDb?: Promise<Client> };

async function connect(): Promise<Client> {
  const url = process.env.DATABASE_URL;
  let client: Client;
  if (url) {
    client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  } else {
    mkdirSync(UPLOADS_DIR, { recursive: true });
    client = createClient({ url: `file:${path.join(DATA_DIR, "bookstand.db")}` });
  }
  await client.executeMultiple(SCHEMA);
  return client;
}

export function getDb(): Promise<Client> {
  globalForDb.__bookstandDb ??= connect();
  return globalForDb.__bookstandDb;
}
