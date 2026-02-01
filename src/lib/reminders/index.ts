import type {
  LinkedEntityType,
  RecurringReminder,
  ReminderFrequency,
} from "../../types/reminder.ts";
import { generateSecureRandomString } from "../auth/crypto.ts";
import { client } from "../db.ts";
import { createNotification } from "../notifications/index.ts";

export { initReminderTables } from "./schema.ts";

type CreateReminderData = {
  title: string;
  description?: string | null;
  frequency: ReminderFrequency;
  nextDue: string;
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string | null;
};

type UpdateReminderData = {
  title?: string;
  description?: string | null;
  frequency?: ReminderFrequency;
  nextDue?: string;
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string | null;
  isActive?: boolean;
};

// Converts a database row to a RecurringReminder object
const rowToReminder = (row: Record<string, unknown>): RecurringReminder => ({
  id: row.id as string,
  title: row.title as string,
  description: row.description as string | null,
  frequency: row.frequency as ReminderFrequency,
  nextDue: row.next_due as string,
  linkedEntityType: row.linked_entity_type as LinkedEntityType,
  linkedEntityId: row.linked_entity_id as string | null,
  isActive: Boolean(row.is_active),
  lastTriggered: row.last_triggered as string | null,
  createdBy: row.created_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

// Advances the next due date based on frequency
export const advanceNextDue = (
  currentDate: string,
  frequency: ReminderFrequency,
): string | null => {
  if (frequency === "one-off") {
    return null;
  }

  const date = new Date(currentDate);

  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "annually":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split("T")[0];
};

// Creates a new reminder
export const createReminder = async (
  data: CreateReminderData,
  userId: string,
): Promise<RecurringReminder> => {
  const id = generateSecureRandomString();
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO recurring_reminder (id, title, description, frequency, next_due, linked_entity_type, linked_entity_id, is_active, last_triggered, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?)`,
    args: [
      id,
      data.title,
      data.description ?? null,
      data.frequency,
      data.nextDue,
      data.linkedEntityType ?? null,
      data.linkedEntityId ?? null,
      userId,
      now,
      now,
    ],
  });

  return {
    id,
    title: data.title,
    description: data.description ?? null,
    frequency: data.frequency,
    nextDue: data.nextDue,
    linkedEntityType: data.linkedEntityType ?? null,
    linkedEntityId: data.linkedEntityId ?? null,
    isActive: true,
    lastTriggered: null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
};

// Gets a single reminder by ID
export const getReminder = async (
  id: string,
): Promise<RecurringReminder | null> => {
  const result = await client.execute({
    sql: `SELECT id, title, description, frequency, next_due, linked_entity_type, linked_entity_id, is_active, last_triggered, created_by, created_at, updated_at
          FROM recurring_reminder
          WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToReminder(result.rows[0]);
};

// Gets all reminders sorted by next due date
export const getAllReminders = async (): Promise<RecurringReminder[]> => {
  const result = await client.execute({
    sql: `SELECT id, title, description, frequency, next_due, linked_entity_type, linked_entity_id, is_active, last_triggered, created_by, created_at, updated_at
          FROM recurring_reminder
          ORDER BY next_due ASC`,
    args: [],
  });

  return result.rows.map(rowToReminder);
};

// Gets all active reminders sorted by next due date
export const getActiveReminders = async (): Promise<RecurringReminder[]> => {
  const result = await client.execute({
    sql: `SELECT id, title, description, frequency, next_due, linked_entity_type, linked_entity_id, is_active, last_triggered, created_by, created_at, updated_at
          FROM recurring_reminder
          WHERE is_active = 1
          ORDER BY next_due ASC`,
    args: [],
  });

  return result.rows.map(rowToReminder);
};

// Gets reminders that are due (nextDue <= today and isActive)
export const getDueReminders = async (): Promise<RecurringReminder[]> => {
  const today = new Date().toISOString().split("T")[0];

  const result = await client.execute({
    sql: `SELECT id, title, description, frequency, next_due, linked_entity_type, linked_entity_id, is_active, last_triggered, created_by, created_at, updated_at
          FROM recurring_reminder
          WHERE is_active = 1 AND next_due <= ?
          ORDER BY next_due ASC`,
    args: [today],
  });

  return result.rows.map(rowToReminder);
};

// Gets reminders linked to a specific entity
export const getRemindersByLinkedEntity = async (
  entityType: string,
  entityId: string,
): Promise<RecurringReminder[]> => {
  const result = await client.execute({
    sql: `SELECT id, title, description, frequency, next_due, linked_entity_type, linked_entity_id, is_active, last_triggered, created_by, created_at, updated_at
          FROM recurring_reminder
          WHERE linked_entity_type = ? AND linked_entity_id = ?
          ORDER BY next_due ASC`,
    args: [entityType, entityId],
  });

  return result.rows.map(rowToReminder);
};

// Updates a reminder
export const updateReminder = async (
  id: string,
  data: UpdateReminderData,
): Promise<RecurringReminder | null> => {
  const existing = await getReminder(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updated = {
    title: data.title ?? existing.title,
    description:
      data.description !== undefined ? data.description : existing.description,
    frequency: data.frequency ?? existing.frequency,
    nextDue: data.nextDue ?? existing.nextDue,
    linkedEntityType:
      data.linkedEntityType !== undefined
        ? data.linkedEntityType
        : existing.linkedEntityType,
    linkedEntityId:
      data.linkedEntityId !== undefined
        ? data.linkedEntityId
        : existing.linkedEntityId,
    isActive: data.isActive ?? existing.isActive,
  };

  await client.execute({
    sql: `UPDATE recurring_reminder
          SET title = ?, description = ?, frequency = ?, next_due = ?, linked_entity_type = ?, linked_entity_id = ?, is_active = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      updated.title,
      updated.description,
      updated.frequency,
      updated.nextDue,
      updated.linkedEntityType,
      updated.linkedEntityId,
      updated.isActive ? 1 : 0,
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

// Triggers a reminder: creates notification and advances nextDue based on frequency
export const triggerReminder = async (
  id: string,
  userId: string,
): Promise<RecurringReminder | null> => {
  const reminder = await getReminder(id);
  if (!reminder) {
    return null;
  }

  const now = new Date().toISOString();
  const today = now.split("T")[0];

  // Create notification for the user
  await createNotification({
    userId,
    type: "info",
    title: "Reminder",
    message: reminder.title,
    actionUrl: "/app/reminders",
    sourceType: "reminder",
    sourceId: reminder.id,
  });

  // Calculate next due date
  const nextDue = advanceNextDue(reminder.nextDue, reminder.frequency);

  if (nextDue) {
    // For recurring reminders, advance the due date
    await client.execute({
      sql: `UPDATE recurring_reminder
            SET next_due = ?, last_triggered = ?, updated_at = ?
            WHERE id = ?`,
      args: [nextDue, today, now, id],
    });

    return {
      ...reminder,
      nextDue,
      lastTriggered: today,
      updatedAt: now,
    };
  }

  // For one-off reminders, mark as inactive
  await client.execute({
    sql: `UPDATE recurring_reminder
          SET is_active = 0, last_triggered = ?, updated_at = ?
          WHERE id = ?`,
    args: [today, now, id],
  });

  return {
    ...reminder,
    isActive: false,
    lastTriggered: today,
    updatedAt: now,
  };
};

// Pauses a reminder
export const pauseReminder = async (
  id: string,
): Promise<RecurringReminder | null> => {
  return updateReminder(id, { isActive: false });
};

// Resumes a reminder
export const resumeReminder = async (
  id: string,
): Promise<RecurringReminder | null> => {
  return updateReminder(id, { isActive: true });
};

// Deletes a reminder
export const deleteReminder = async (id: string): Promise<boolean> => {
  const result = await client.execute({
    sql: "DELETE FROM recurring_reminder WHERE id = ?",
    args: [id],
  });

  return result.rowsAffected > 0;
};
