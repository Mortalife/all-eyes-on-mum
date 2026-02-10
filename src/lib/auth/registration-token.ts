import type { User } from "../../types/user.ts";
import { client } from "../db.ts";
import { generateSecureRandomString, hashSecret } from "./crypto.ts";
import { findUserById } from "./user.ts";

// Token expiry: 24 hours
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Creates a registration token for a user and returns the raw token.
// Invalidates any existing tokens for that user first.
// The token is stored as a SHA-256 hash (per Copenhagen Book recommendation).
export const createRegistrationToken = async (
  userId: string,
): Promise<string> => {
  // Invalidate existing tokens for this user
  await client.execute({
    sql: "DELETE FROM registration_token WHERE user_id = ?",
    args: [userId],
  });

  const now = Date.now();
  const id = generateSecureRandomString();
  const rawToken = generateSecureRandomString();
  const tokenHash = await hashSecret(rawToken);

  await client.execute({
    sql: `INSERT INTO registration_token (id, user_id, token_hash, expires_at)
          VALUES (?, ?, ?, ?)`,
    args: [id, userId, tokenHash, Math.floor((now + TOKEN_EXPIRY_MS) / 1000)],
  });

  return rawToken;
};

// Validates a registration token and returns the associated user if valid.
// This is a single-use operation: the token is deleted upon successful validation.
// Hashes the incoming token with SHA-256 before querying (Copenhagen Book pattern).
export const consumeRegistrationToken = async (
  rawToken: string,
): Promise<User | null> => {
  const tokenHash = await hashSecret(rawToken);
  const now = Math.floor(Date.now() / 1000);

  // Query by the hashed token
  const result = await client.execute({
    sql: `SELECT id, user_id, expires_at FROM registration_token WHERE token_hash = ?`,
    args: [tokenHash],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const tokenId = row.id as string;
  const userId = row.user_id as string;

  // Delete the token (single-use) regardless of expiry
  await client.execute({
    sql: "DELETE FROM registration_token WHERE id = ?",
    args: [tokenId],
  });

  // Check expiry after deletion
  if ((row.expires_at as number) < now) return null;

  return findUserById(userId);
};

// Validates a registration token without consuming it (for GET requests).
// Returns the associated user if the token is valid and not expired.
export const validateRegistrationToken = async (
  rawToken: string,
): Promise<User | null> => {
  const tokenHash = await hashSecret(rawToken);
  const now = Math.floor(Date.now() / 1000);

  const result = await client.execute({
    sql: `SELECT user_id, expires_at FROM registration_token WHERE token_hash = ?`,
    args: [tokenHash],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  if ((row.expires_at as number) < now) return null;

  return findUserById(row.user_id as string);
};

// Deletes all registration tokens for a user
export const deleteRegistrationTokens = async (
  userId: string,
): Promise<void> => {
  await client.execute({
    sql: "DELETE FROM registration_token WHERE user_id = ?",
    args: [userId],
  });
};

// Cleans up expired registration tokens
export const cleanupExpiredRegistrationTokens = async (): Promise<void> => {
  const now = Math.floor(Date.now() / 1000);
  await client.execute({
    sql: "DELETE FROM registration_token WHERE expires_at < ?",
    args: [now],
  });
};
