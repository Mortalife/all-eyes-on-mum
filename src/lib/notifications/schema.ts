import { client } from "../db.ts";

// Initializes the notification table
export const initNotificationTable = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS notification (
      id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      message TEXT NOT NULL,
      action_url TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      source_type TEXT,
      source_id TEXT,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  // Migration: Add source columns if they don't exist (for existing databases)
  try {
    await client.execute(
      `ALTER TABLE notification ADD COLUMN source_type TEXT`,
    );
  } catch {
    // Column already exists, ignore
  }
  try {
    await client.execute(`ALTER TABLE notification ADD COLUMN source_id TEXT`);
  } catch {
    // Column already exists, ignore
  }

  // Index for faster lookups by user
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_notification_user_id ON notification(user_id)
  `);

  // Index for unread notifications (partial index for efficiency)
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_notification_unread ON notification(user_id, read) WHERE read = 0
  `);

  // Index for deduplication lookups by source
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_notification_source ON notification(user_id, source_type, source_id, created_at)
  `);
};
