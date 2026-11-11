import { client } from "../db.ts";

// Initializes the push subscription table (one row per device a user enabled push on)
export const initPushSubscriptionTable = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS push_subscription (
      endpoint TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_push_subscription_user_id ON push_subscription(user_id)
  `);
};
