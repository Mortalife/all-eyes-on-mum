import type { Note } from "../../types/note.ts";
import { generateSecureRandomString } from "../auth/crypto.ts";
import { client } from "../db.ts";

export { initNoteTables } from "./schema.ts";

// Converts a database row to a Note object
const rowToNote = (row: Record<string, unknown>): Note => ({
  id: row.id as string,
  content: row.content as string,
  resolved: (row.resolved as number) === 1,
  resolvedAt: row.resolved_at as string | null,
  resolvedBy: row.resolved_by as string | null,
  createdBy: row.created_by as string,
  createdAt: row.created_at as string,
});

// Creates a new note
export const createNote = async (
  content: string,
  userId: string,
): Promise<Note> => {
  const id = generateSecureRandomString();
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO note (id, content, resolved, created_by, created_at)
          VALUES (?, ?, 0, ?, ?)`,
    args: [id, content, userId, now],
  });

  return {
    id,
    content,
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
    createdBy: userId,
    createdAt: now,
  };
};

// Gets a single note by ID
export const getNote = async (id: string): Promise<Note | null> => {
  const result = await client.execute({
    sql: `SELECT id, content, resolved, resolved_at, resolved_by, created_by, created_at
          FROM note
          WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToNote(result.rows[0]);
};

// Gets all notes sorted by createdAt descending (most recent first)
export const getAllNotes = async (): Promise<Note[]> => {
  const result = await client.execute({
    sql: `SELECT id, content, resolved, resolved_at, resolved_by, created_by, created_at
          FROM note
          ORDER BY created_at DESC`,
    args: [],
  });

  return result.rows.map(rowToNote);
};

// Gets active (unresolved) notes sorted by createdAt descending
export const getActiveNotes = async (): Promise<Note[]> => {
  const result = await client.execute({
    sql: `SELECT id, content, resolved, resolved_at, resolved_by, created_by, created_at
          FROM note
          WHERE resolved = 0
          ORDER BY created_at DESC`,
    args: [],
  });

  return result.rows.map(rowToNote);
};

// Gets resolved notes with optional limit
export const getResolvedNotes = async (limit?: number): Promise<Note[]> => {
  const sql = limit
    ? `SELECT id, content, resolved, resolved_at, resolved_by, created_by, created_at
       FROM note
       WHERE resolved = 1
       ORDER BY resolved_at DESC
       LIMIT ?`
    : `SELECT id, content, resolved, resolved_at, resolved_by, created_by, created_at
       FROM note
       WHERE resolved = 1
       ORDER BY resolved_at DESC`;

  const args = limit ? [limit] : [];

  const result = await client.execute({ sql, args });

  return result.rows.map(rowToNote);
};

// Marks a note as resolved
export const resolveNote = async (
  id: string,
  userId: string,
): Promise<Note | null> => {
  const existing = await getNote(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();

  await client.execute({
    sql: `UPDATE note
          SET resolved = 1, resolved_at = ?, resolved_by = ?
          WHERE id = ?`,
    args: [now, userId, id],
  });

  return {
    ...existing,
    resolved: true,
    resolvedAt: now,
    resolvedBy: userId,
  };
};

// Marks a note as unresolved (undo resolve)
export const unresolveNote = async (id: string): Promise<Note | null> => {
  const existing = await getNote(id);
  if (!existing) {
    return null;
  }

  await client.execute({
    sql: `UPDATE note
          SET resolved = 0, resolved_at = NULL, resolved_by = NULL
          WHERE id = ?`,
    args: [id],
  });

  return {
    ...existing,
    resolved: false,
    resolvedAt: null,
    resolvedBy: null,
  };
};

// Deletes a note
export const deleteNote = async (id: string): Promise<boolean> => {
  const result = await client.execute({
    sql: "DELETE FROM note WHERE id = ?",
    args: [id],
  });

  return result.rowsAffected > 0;
};
