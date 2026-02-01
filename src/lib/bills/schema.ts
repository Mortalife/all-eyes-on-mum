import { client } from "../db.ts";

// Initializes the bill and bill_payment tables
export const initBillTables = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS bill (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL,
      frequency TEXT NOT NULL,
      due_date TEXT NOT NULL,
      category TEXT NOT NULL,
      notes TEXT,
      reminder_days INTEGER NOT NULL DEFAULT 7,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS bill_payment (
      id TEXT NOT NULL PRIMARY KEY,
      bill_id TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_at TEXT NOT NULL,
      paid_by TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (bill_id) REFERENCES bill(id) ON DELETE CASCADE,
      FOREIGN KEY (paid_by) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  // Index for faster lookups by due date
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_bill_due_date ON bill(due_date)
  `);

  // Index for faster lookups of payments by bill
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_bill_payment_bill_id ON bill_payment(bill_id)
  `);
};
