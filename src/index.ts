import { serve } from "@hono/node-server";
import { env } from "./env.js";
import { initAuthTables } from "./lib/auth/index.js";
import { commandStore } from "./lib/cqrs/index.js";
import { initDatabase } from "./lib/db.js";
import app from "./server.js";

// Initializes the application
const start = async () => {
  // Initialize database
  await initDatabase();
  console.log("Database initialized");

  // Initialize auth tables
  await initAuthTables();
  console.log("Auth tables initialized");

  // Start command processor
  commandStore.start();
  console.log("Command processor started");

  // Start HTTP server
  serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    (info) => {
      console.log(`Server running at http://localhost:${info.port}`);
    },
  );
};

start().catch(console.error);
