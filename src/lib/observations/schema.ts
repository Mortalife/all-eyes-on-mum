import { client } from "../db.ts";

// Initializes the observation table
export const initObservationTables = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS observation (
      id TEXT NOT NULL PRIMARY KEY,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  // Index for faster lookups by observed date
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_observation_observed_at ON observation(observed_at)
  `);

  // Index for filtering by category
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_observation_category ON observation(category)
  `);
};
