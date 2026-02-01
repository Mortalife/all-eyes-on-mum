import { createClient } from "@libsql/client";
import { env } from "../env.js";

// Resolves the database path
const getDatabaseUrl = () => {
  const basePath = env.DATABASE_PATH || "./data/";
  return `file:${basePath}app.sqlite`;
};

// Creates LibSQL client with optimized pragmas
export const client = createClient({
  url: getDatabaseUrl(),
});

// Initializes database with performance optimizations
export const initDatabase = async () => {
  await client.execute("PRAGMA journal_mode = WAL");
  await client.execute("PRAGMA busy_timeout = 5000");
  await client.execute("PRAGMA synchronous = NORMAL");
  await client.execute("PRAGMA cache_size = 2000");
  await client.execute("PRAGMA foreign_keys = ON");
};
