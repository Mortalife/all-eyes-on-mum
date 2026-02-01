import { client } from "../db.ts";

// Initializes the note table
export const initNoteTables = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS note (
      id TEXT NOT NULL PRIMARY KEY,
      content TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (resolved_by) REFERENCES user(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  // Index for faster lookups by resolved status
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_note_resolved ON note(resolved)
  `);

  // Index for ordering by creation date
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_note_created_at ON note(created_at)
  `);
};
