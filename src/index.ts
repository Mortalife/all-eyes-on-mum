import { serve } from "@hono/node-server";
import { env } from "./env.ts";
import { startJobRunner } from "./jobs.ts";
import { initAppointmentTables } from "./lib/appointments/index.ts";
import { initAuthTables } from "./lib/auth/index.ts";
import { initBillTables } from "./lib/bills/index.ts";
import { initContractTables } from "./lib/contracts/index.ts";
import { commandStore } from "./lib/cqrs/index.ts";
import { initDatabase } from "./lib/db.ts";
import { initHealthNoteTables } from "./lib/health-notes/index.ts";
import { initNoteTables } from "./lib/notes/index.ts";
import { initNotificationTable } from "./lib/notifications/index.ts";
import { initObservationTables } from "./lib/observations/index.ts";
import { initReminderTables } from "./lib/reminders/index.ts";
import app from "./server.ts";

// Initializes the application
const start = async () => {
  // Initialize database
  await initDatabase();
  console.log("Database initialized");

  // Initialize auth tables
  await initAuthTables();
  console.log("Auth tables initialized");

  // Initialize notification table
  await initNotificationTable();
  console.log("Notification table initialized");

  // Initialize bill tables (legacy, kept for migration)
  await initBillTables();
  console.log("Bill tables initialized");

  // Initialize contract tables
  await initContractTables();
  console.log("Contract tables initialized");

  // Initialize reminder tables
  await initReminderTables();
  console.log("Reminder tables initialized");

  // Initialize appointment tables
  await initAppointmentTables();
  console.log("Appointment tables initialized");

  // Initialize health note tables
  await initHealthNoteTables();
  console.log("Health note tables initialized");

  // Initialize note tables
  await initNoteTables();
  console.log("Note tables initialized");

  // Initialize observation tables
  await initObservationTables();
  console.log("Observation tables initialized");

  // Start command processor
  commandStore.start();
  console.log("Command processor started");

  // Start background job runner
  await startJobRunner();

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
