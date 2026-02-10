import { client } from "../db.ts";

// Initializes auth tables
export const initAuthTables = async () => {
  // User table (password_hash is nullable for invite-based registration)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT NOT NULL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT
  `);

  // Migration: make password_hash nullable for existing databases
  await migratePasswordHashNullable();

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

  // Registration token table - stores SHA-256 hashed tokens for invite-based registration
  await client.execute(`
    CREATE TABLE IF NOT EXISTS registration_token (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash BLOB NOT NULL,
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

  // Index for faster registration token lookups by user
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_registration_token_user_id ON registration_token(user_id)
  `);
};

// Migrates password_hash from NOT NULL to nullable by recreating the table
const migratePasswordHashNullable = async () => {
  const result = await client.execute(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='user'`,
  );
  if (result.rows.length === 0) return;

  const createSql = result.rows[0].sql as string;
  if (!createSql.includes("password_hash TEXT NOT NULL")) return;

  await client.execute(`BEGIN TRANSACTION`);
  try {
    await client.execute(`
      CREATE TABLE user_new (
        id TEXT NOT NULL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT
    `);
    await client.execute(`
      INSERT INTO user_new SELECT * FROM user
    `);
    await client.execute(`DROP TABLE user`);
    await client.execute(`ALTER TABLE user_new RENAME TO user`);
    await client.execute(`COMMIT`);
  } catch (error) {
    await client.execute(`ROLLBACK`);
    throw error;
  }
};
