import { client } from "../db.ts";

// Initializes the appointment table
export const initAppointmentTables = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS appointment (
      id TEXT NOT NULL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      datetime TEXT NOT NULL,
      end_time TEXT,
      location TEXT,
      type TEXT NOT NULL,
      reminder_days INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  // Index for faster lookups by datetime
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_appointment_datetime ON appointment(datetime)
  `);

  // Index for filtering by type
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_appointment_type ON appointment(type)
  `);
};
