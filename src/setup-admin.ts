import { initDatabase, client } from "./lib/db.ts";
import { initAuthTables } from "./lib/auth/schema.ts";
import { bootstrapAdmin } from "./lib/auth/bootstrap.ts";

try {
  await initDatabase();
  await initAuthTables();
  const url = await bootstrapAdmin();
  console.log(
    "Open this private, single-use link within 24 hours to set the admin password:",
  );
  console.log(url);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Admin setup failed");
  process.exitCode = 1;
} finally {
  client.close();
}
