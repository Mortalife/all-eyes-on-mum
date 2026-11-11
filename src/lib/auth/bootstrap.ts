import { env } from "../../env.ts";
import { client } from "../db.ts";
import { generateSecureRandomString } from "./crypto.ts";
import { createRegistrationToken } from "./registration-token.ts";

// Called only from the local setup command, never from an HTTP endpoint.
export const bootstrapAdmin = async (): Promise<string> => {
  const id = generateSecureRandomString();
  const now = Math.floor(Date.now() / 1000);
  const result = await client.execute({
    sql: `INSERT INTO user (id, email, name, password_hash, role, created_at, updated_at)
          SELECT ?, ?, 'Admin', NULL, 'admin', ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM user WHERE role = 'admin')
          ON CONFLICT(email) DO NOTHING RETURNING id`,
    args: [id, env.ADMIN_EMAIL.trim().toLowerCase(), now, now],
  });
  if (!result.rows.length) {
    // Allow a local operator to recover an uncompleted setup, but never reset an active account.
    const pending = await client.execute({
      sql: "SELECT id FROM user WHERE email = ? AND role = 'admin' AND password_hash IS NULL",
      args: [env.ADMIN_EMAIL.trim().toLowerCase()],
    });
    if (!pending.rows.length)
      throw new Error(
        "Admin setup is already complete or the configured email is in use.",
      );
    return `${env.BASE_URL}/auth/register/${await createRegistrationToken(pending.rows[0].id as string)}`;
  }
  return `${env.BASE_URL}/auth/register/${await createRegistrationToken(id)}`;
};
