import type {
  Observation,
  ObservationCategory,
} from "../../types/observation.ts";
import { generateSecureRandomString } from "../auth/crypto.ts";
import { client } from "../db.ts";

export { initObservationTables } from "./schema.ts";

// Converts a database row to an Observation object
const rowToObservation = (row: Record<string, unknown>): Observation => ({
  id: row.id as string,
  content: row.content as string,
  category: row.category as ObservationCategory,
  observedAt: row.observed_at as string,
  createdBy: row.created_by as string,
  createdAt: row.created_at as string,
});

type CreateObservationData = {
  content: string;
  category: ObservationCategory;
  observedAt: string;
};

// Creates a new observation
export const createObservation = async (
  data: CreateObservationData,
  userId: string,
): Promise<Observation> => {
  const id = generateSecureRandomString();
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO observation (id, content, category, observed_at, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, data.content, data.category, data.observedAt, userId, now],
  });

  return {
    id,
    content: data.content,
    category: data.category,
    observedAt: data.observedAt,
    createdBy: userId,
    createdAt: now,
  };
};

// Gets a single observation by ID
export const getObservation = async (
  id: string,
): Promise<Observation | null> => {
  const result = await client.execute({
    sql: `SELECT id, content, category, observed_at, created_by, created_at
          FROM observation
          WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToObservation(result.rows[0]);
};

// Gets all observations sorted by observedAt descending (most recent first)
export const getAllObservations = async (): Promise<Observation[]> => {
  const result = await client.execute({
    sql: `SELECT id, content, category, observed_at, created_by, created_at
          FROM observation
          ORDER BY observed_at DESC, created_at DESC`,
    args: [],
  });

  return result.rows.map(rowToObservation);
};

// Gets observations by category
export const getObservationsByCategory = async (
  category: ObservationCategory,
): Promise<Observation[]> => {
  const result = await client.execute({
    sql: `SELECT id, content, category, observed_at, created_by, created_at
          FROM observation
          WHERE category = ?
          ORDER BY observed_at DESC, created_at DESC`,
    args: [category],
  });

  return result.rows.map(rowToObservation);
};

// Gets observations within a date range
export const getObservationsByDateRange = async (
  startDate: string,
  endDate: string,
): Promise<Observation[]> => {
  const result = await client.execute({
    sql: `SELECT id, content, category, observed_at, created_by, created_at
          FROM observation
          WHERE observed_at >= ? AND observed_at <= ?
          ORDER BY observed_at DESC, created_at DESC`,
    args: [startDate, endDate],
  });

  return result.rows.map(rowToObservation);
};

// Searches observations by content
export const searchObservations = async (
  query: string,
): Promise<Observation[]> => {
  const result = await client.execute({
    sql: `SELECT id, content, category, observed_at, created_by, created_at
          FROM observation
          WHERE content LIKE ?
          ORDER BY observed_at DESC, created_at DESC`,
    args: [`%${query}%`],
  });

  return result.rows.map(rowToObservation);
};

// Deletes an observation
export const deleteObservation = async (id: string): Promise<boolean> => {
  const result = await client.execute({
    sql: "DELETE FROM observation WHERE id = ?",
    args: [id],
  });

  return result.rowsAffected > 0;
};
