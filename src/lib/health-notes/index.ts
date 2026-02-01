import type {
  HealthNote,
  HealthNoteCategory,
} from "../../types/health-note.ts";
import { generateSecureRandomString } from "../auth/crypto.ts";
import { client } from "../db.ts";

export { initHealthNoteTables } from "./schema.ts";

type CreateHealthNoteData = {
  title: string;
  content: string;
  category: HealthNoteCategory;
  date: string;
};

type UpdateHealthNoteData = {
  title?: string;
  content?: string;
  category?: HealthNoteCategory;
  date?: string;
};

// Converts a database row to a HealthNote object
const rowToHealthNote = (row: Record<string, unknown>): HealthNote => ({
  id: row.id as string,
  title: row.title as string,
  content: row.content as string,
  category: row.category as HealthNoteCategory,
  date: row.date as string,
  createdBy: row.created_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

// Creates a new health note
export const createHealthNote = async (
  data: CreateHealthNoteData,
  userId: string,
): Promise<HealthNote> => {
  const id = generateSecureRandomString();
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO health_note (id, title, content, category, date, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.title,
      data.content,
      data.category,
      data.date,
      userId,
      now,
      now,
    ],
  });

  return {
    id,
    title: data.title,
    content: data.content,
    category: data.category,
    date: data.date,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
};

// Gets a single health note by ID
export const getHealthNote = async (id: string): Promise<HealthNote | null> => {
  const result = await client.execute({
    sql: `SELECT id, title, content, category, date, created_by, created_at, updated_at
          FROM health_note
          WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToHealthNote(result.rows[0]);
};

// Gets all health notes sorted by date descending (most recent first)
export const getAllHealthNotes = async (): Promise<HealthNote[]> => {
  const result = await client.execute({
    sql: `SELECT id, title, content, category, date, created_by, created_at, updated_at
          FROM health_note
          ORDER BY date DESC, created_at DESC`,
    args: [],
  });

  return result.rows.map(rowToHealthNote);
};

// Gets health notes by category
export const getHealthNotesByCategory = async (
  category: HealthNoteCategory,
): Promise<HealthNote[]> => {
  const result = await client.execute({
    sql: `SELECT id, title, content, category, date, created_by, created_at, updated_at
          FROM health_note
          WHERE category = ?
          ORDER BY date DESC, created_at DESC`,
    args: [category],
  });

  return result.rows.map(rowToHealthNote);
};

// Searches health notes by title and content
export const searchHealthNotes = async (
  query: string,
): Promise<HealthNote[]> => {
  const searchTerm = `%${query}%`;

  const result = await client.execute({
    sql: `SELECT id, title, content, category, date, created_by, created_at, updated_at
          FROM health_note
          WHERE title LIKE ? OR content LIKE ?
          ORDER BY date DESC, created_at DESC`,
    args: [searchTerm, searchTerm],
  });

  return result.rows.map(rowToHealthNote);
};

// Updates a health note
export const updateHealthNote = async (
  id: string,
  data: UpdateHealthNoteData,
): Promise<HealthNote | null> => {
  const existing = await getHealthNote(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updated = {
    title: data.title ?? existing.title,
    content: data.content ?? existing.content,
    category: data.category ?? existing.category,
    date: data.date ?? existing.date,
  };

  await client.execute({
    sql: `UPDATE health_note
          SET title = ?, content = ?, category = ?, date = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      updated.title,
      updated.content,
      updated.category,
      updated.date,
      now,
      id,
    ],
  });

  return {
    ...existing,
    ...updated,
    updatedAt: now,
  };
};

// Deletes a health note
export const deleteHealthNote = async (id: string): Promise<boolean> => {
  const result = await client.execute({
    sql: "DELETE FROM health_note WHERE id = ?",
    args: [id],
  });

  return result.rowsAffected > 0;
};
