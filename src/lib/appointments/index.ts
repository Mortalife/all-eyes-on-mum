import type { Appointment, AppointmentType } from "../../types/appointment.ts";
import { generateSecureRandomString } from "../auth/crypto.ts";
import { client } from "../db.ts";

export { initAppointmentTables } from "./schema.ts";

type CreateAppointmentData = {
  title: string;
  description?: string | null;
  datetime: string;
  endTime?: string | null;
  location?: string | null;
  type: AppointmentType;
  reminderDays?: number;
};

type UpdateAppointmentData = {
  title?: string;
  description?: string | null;
  datetime?: string;
  endTime?: string | null;
  location?: string | null;
  type?: AppointmentType;
  reminderDays?: number;
};

// Converts a database row to an Appointment object
const rowToAppointment = (row: Record<string, unknown>): Appointment => ({
  id: row.id as string,
  title: row.title as string,
  description: row.description as string | null,
  datetime: row.datetime as string,
  endTime: row.end_time as string | null,
  location: row.location as string | null,
  type: row.type as AppointmentType,
  reminderDays: row.reminder_days as number,
  createdBy: row.created_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

// Creates a new appointment
export const createAppointment = async (
  data: CreateAppointmentData,
  userId: string,
): Promise<Appointment> => {
  const id = generateSecureRandomString();
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO appointment (id, title, description, datetime, end_time, location, type, reminder_days, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.title,
      data.description ?? null,
      data.datetime,
      data.endTime ?? null,
      data.location ?? null,
      data.type,
      data.reminderDays ?? 1,
      userId,
      now,
      now,
    ],
  });

  return {
    id,
    title: data.title,
    description: data.description ?? null,
    datetime: data.datetime,
    endTime: data.endTime ?? null,
    location: data.location ?? null,
    type: data.type,
    reminderDays: data.reminderDays ?? 1,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
};

// Gets a single appointment by ID
export const getAppointment = async (
  id: string,
): Promise<Appointment | null> => {
  const result = await client.execute({
    sql: `SELECT id, title, description, datetime, end_time, location, type, reminder_days, created_by, created_at, updated_at
          FROM appointment
          WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToAppointment(result.rows[0]);
};

// Gets all appointments sorted by datetime
export const getAllAppointments = async (): Promise<Appointment[]> => {
  const result = await client.execute({
    sql: `SELECT id, title, description, datetime, end_time, location, type, reminder_days, created_by, created_at, updated_at
          FROM appointment
          ORDER BY datetime ASC`,
    args: [],
  });

  return result.rows.map(rowToAppointment);
};

// Gets upcoming appointments within the specified number of days
export const getUpcomingAppointments = async (
  days: number,
): Promise<Appointment[]> => {
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + days);

  const nowStr = now.toISOString();
  const futureStr = futureDate.toISOString();

  const result = await client.execute({
    sql: `SELECT id, title, description, datetime, end_time, location, type, reminder_days, created_by, created_at, updated_at
          FROM appointment
          WHERE datetime >= ? AND datetime <= ?
          ORDER BY datetime ASC`,
    args: [nowStr, futureStr],
  });

  return result.rows.map(rowToAppointment);
};

// Gets past appointments with optional limit
export const getPastAppointments = async (
  limit?: number,
): Promise<Appointment[]> => {
  const now = new Date().toISOString();

  const sql = limit
    ? `SELECT id, title, description, datetime, end_time, location, type, reminder_days, created_by, created_at, updated_at
       FROM appointment
       WHERE datetime < ?
       ORDER BY datetime DESC
       LIMIT ?`
    : `SELECT id, title, description, datetime, end_time, location, type, reminder_days, created_by, created_at, updated_at
       FROM appointment
       WHERE datetime < ?
       ORDER BY datetime DESC`;

  const args = limit ? [now, limit] : [now];

  const result = await client.execute({ sql, args });

  return result.rows.map(rowToAppointment);
};

// Updates an appointment
export const updateAppointment = async (
  id: string,
  data: UpdateAppointmentData,
): Promise<Appointment | null> => {
  const existing = await getAppointment(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updated = {
    title: data.title ?? existing.title,
    description:
      data.description !== undefined ? data.description : existing.description,
    datetime: data.datetime ?? existing.datetime,
    endTime: data.endTime !== undefined ? data.endTime : existing.endTime,
    location: data.location !== undefined ? data.location : existing.location,
    type: data.type ?? existing.type,
    reminderDays: data.reminderDays ?? existing.reminderDays,
  };

  await client.execute({
    sql: `UPDATE appointment
          SET title = ?, description = ?, datetime = ?, end_time = ?, location = ?, type = ?, reminder_days = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      updated.title,
      updated.description,
      updated.datetime,
      updated.endTime,
      updated.location,
      updated.type,
      updated.reminderDays,
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

// Deletes an appointment
export const deleteAppointment = async (id: string): Promise<boolean> => {
  const result = await client.execute({
    sql: "DELETE FROM appointment WHERE id = ?",
    args: [id],
  });

  return result.rowsAffected > 0;
};

// Gets appointments by type
export const getAppointmentsByType = async (
  type: AppointmentType,
): Promise<Appointment[]> => {
  const result = await client.execute({
    sql: `SELECT id, title, description, datetime, end_time, location, type, reminder_days, created_by, created_at, updated_at
          FROM appointment
          WHERE type = ?
          ORDER BY datetime ASC`,
    args: [type],
  });

  return result.rows.map(rowToAppointment);
};
