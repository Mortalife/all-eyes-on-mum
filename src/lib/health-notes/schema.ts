import { client } from "../db.ts";

// Initializes the health_note table
export const initHealthNoteTables = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS health_note (
      id TEXT NOT NULL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  // Index for faster lookups by date
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_health_note_date ON health_note(date)
  `);

  // Index for filtering by category
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_health_note_category ON health_note(category)
  `);
};
