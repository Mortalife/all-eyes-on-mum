import { client } from "../db.ts";

// Initializes the contract table
export const initContractTables = async () => {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS contract (
      id TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT,
      monthly_amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'direct_debit',
      contract_start_date TEXT,
      contract_end_date TEXT,
      category TEXT NOT NULL,
      is_usage_based INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES user(id) ON DELETE CASCADE
    ) STRICT
  `);

  // Index for faster lookups by contract end date
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_contract_end_date ON contract(contract_end_date)
  `);

  // Index for faster lookups by category
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_contract_category ON contract(category)
  `);
};
