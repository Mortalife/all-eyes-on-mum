import { client } from "../db.ts";

// Initializes the recurring_reminder table
export const initReminderTables = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS recurring_reminder (
      id TEXT NOT NULL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      frequency TEXT NOT NULL,
      next_due TEXT NOT NULL,
      linked_entity_type TEXT,
      linked_entity_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_triggered TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  // Index for faster lookups by next due date
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_reminder_next_due ON recurring_reminder(next_due)
  `);

  // Index for faster lookups by linked entity
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_reminder_linked_entity ON recurring_reminder(linked_entity_type, linked_entity_id)
  `);

  // Index for active reminders
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_reminder_active ON recurring_reminder(is_active)
  `);
};
