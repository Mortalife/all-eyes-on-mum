import type { User } from "../../types/user.js";
import type { Session } from "../../types/hono.js";
import { client } from "../db.js";
import {
  constantTimeEqual,
  generateSecureRandomString,
  hashSecret,
} from "./crypto.js";

// Session expiry: 30 days
const SESSION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Creates a new session for a user, returns the token
export const createSession = async (userId: string): Promise<string> => {
  const now = Date.now();
  const id = generateSecureRandomString();
  const secret = generateSecureRandomString();
  const secretHash = await hashSecret(secret);
  const token = `${id}.${secret}`;

  await client.execute({
    sql: `INSERT INTO session (id, user_id, secret_hash, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      id,
      userId,
      secretHash,
      Math.floor(now / 1000),
      Math.floor((now + SESSION_EXPIRY_MS) / 1000),
    ],
  });

  return token;
};

// Validates a session token and returns session + user if valid
export const validateSessionToken = async (
  token: string,
): Promise<{ session: Session; user: User } | null> => {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [sessionId, sessionSecret] = parts;
  if (!sessionId || !sessionSecret) return null;

  // Fetch session with user data
  const result = await client.execute({
    sql: `SELECT
            s.id, s.user_id, s.secret_hash, s.created_at, s.expires_at,
            u.id as u_id, u.email, u.name, u.role, u.created_at as u_created_at, u.updated_at
          FROM session s
          JOIN user u ON s.user_id = u.id
          WHERE s.id = ?`,
    args: [sessionId],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const now = Math.floor(Date.now() / 1000);

  // Check if session is expired
  if ((row.expires_at as number) < now) {
    await deleteSession(sessionId);
    return null;
  }

  // Verify the secret using constant-time comparison
  const storedHash = row.secret_hash as Uint8Array;
  const tokenSecretHash = await hashSecret(sessionSecret);

  if (!constantTimeEqual(tokenSecretHash, storedHash)) {
    return null;
  }

  const session: Session = {
    token: sessionId,
    userId: row.user_id as string,
    expiresAt: new Date((row.expires_at as number) * 1000).toISOString(),
  };

  const user: User = {
    id: row.u_id as string,
    email: row.email as string,
    name: row.name as string | null,
    role: row.role as "admin" | "user",
    createdAt: new Date((row.u_created_at as number) * 1000).toISOString(),
    updatedAt: new Date((row.updated_at as number) * 1000).toISOString(),
  };

  return { session, user };
};

// Deletes a session by ID
export const deleteSession = async (sessionId: string): Promise<void> => {
  await client.execute({
    sql: "DELETE FROM session WHERE id = ?",
    args: [sessionId],
  });
};

// Deletes all sessions for a user
export const deleteUserSessions = async (userId: string): Promise<void> => {
  await client.execute({
    sql: "DELETE FROM session WHERE user_id = ?",
    args: [userId],
  });
};

// Extends session expiry (call periodically to keep session alive)
export const extendSession = async (sessionId: string): Promise<void> => {
  const now = Date.now();
  await client.execute({
    sql: "UPDATE session SET expires_at = ? WHERE id = ?",
    args: [Math.floor((now + SESSION_EXPIRY_MS) / 1000), sessionId],
  });
};
