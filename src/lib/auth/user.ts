import { env } from "../../env.ts";
import type { User } from "../../types/user.ts";
import { client } from "../db.ts";
import {
  generateSecureRandomString,
  hashPassword,
  verifyPassword,
} from "./crypto.ts";

// Creates a new user with specified role
export const createUser = async (
  email: string,
  password: string,
  name?: string,
  role: "admin" | "user" = "user",
): Promise<User> => {
  const now = Math.floor(Date.now() / 1000);
  const id = generateSecureRandomString();
  const passwordHash = await hashPassword(password);

  await client.execute({
    sql: `INSERT INTO user (id, email, name, password_hash, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, email.toLowerCase(), name || null, passwordHash, role, now, now],
  });

  return {
    id,
    email: email.toLowerCase(),
    name: name || null,
    role,
    createdAt: new Date(now * 1000).toISOString(),
    updatedAt: new Date(now * 1000).toISOString(),
  };
};

// Finds a user by email
export const findUserByEmail = async (email: string): Promise<User | null> => {
  const result = await client.execute({
    sql: "SELECT id, email, name, role, created_at, updated_at FROM user WHERE email = ?",
    args: [email.toLowerCase()],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string | null,
    role: row.role as "admin" | "user",
    createdAt: new Date((row.created_at as number) * 1000).toISOString(),
    updatedAt: new Date((row.updated_at as number) * 1000).toISOString(),
  };
};

// Verifies user credentials and returns user if valid
export const verifyUserCredentials = async (
  email: string,
  password: string,
): Promise<User | null> => {
  const result = await client.execute({
    sql: "SELECT id, email, name, role, password_hash, created_at, updated_at FROM user WHERE email = ?",
    args: [email.toLowerCase()],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const passwordHash = row.password_hash as string;

  const valid = await verifyPassword(password, passwordHash);
  if (!valid) return null;

  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string | null,
    role: row.role as "admin" | "user",
    createdAt: new Date((row.created_at as number) * 1000).toISOString(),
    updatedAt: new Date((row.updated_at as number) * 1000).toISOString(),
  };
};

// Checks if an email is already registered
export const emailExists = async (email: string): Promise<boolean> => {
  const result = await client.execute({
    sql: "SELECT 1 FROM user WHERE email = ?",
    args: [email.toLowerCase()],
  });
  return result.rows.length > 0;
};

// Checks if the admin account exists
export const adminExists = async (): Promise<boolean> => {
  const result = await client.execute({
    sql: "SELECT 1 FROM user WHERE email = ?",
    args: [env.ADMIN_EMAIL.toLowerCase()],
  });
  return result.rows.length > 0;
};

// Checks if public registration is allowed (only if admin doesn't exist yet)
export const isRegistrationOpen = async (): Promise<boolean> => {
  return !(await adminExists());
};

// Checks if an email is the configured admin email
export const isAdminEmail = (email: string): boolean => {
  return email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
};

// Finds a user by ID
export const findUserById = async (id: string): Promise<User | null> => {
  const result = await client.execute({
    sql: "SELECT id, email, name, role, created_at, updated_at FROM user WHERE id = ?",
    args: [id],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string | null,
    role: row.role as "admin" | "user",
    createdAt: new Date((row.created_at as number) * 1000).toISOString(),
    updatedAt: new Date((row.updated_at as number) * 1000).toISOString(),
  };
};

// Gets all users (for admin)
export const getAllUsers = async (): Promise<User[]> => {
  const result = await client.execute({
    sql: "SELECT id, email, name, role, created_at, updated_at FROM user ORDER BY created_at DESC",
    args: [],
  });

  return result.rows.map((row) => ({
    id: row.id as string,
    email: row.email as string,
    name: row.name as string | null,
    role: row.role as "admin" | "user",
    createdAt: new Date((row.created_at as number) * 1000).toISOString(),
    updatedAt: new Date((row.updated_at as number) * 1000).toISOString(),
  }));
};
