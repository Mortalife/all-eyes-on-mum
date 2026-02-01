import { client } from "../db.js";

// Initializes auth tables
export const initAuthTables = async () => {
  // User table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT NOT NULL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT
  `);

  // Session table - stores hashed secret for security
  await client.execute(`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      secret_hash BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  // Index for faster session lookups by user
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id)
  `);

  // Index for faster email lookups
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_user_email ON user(email)
  `);
};
