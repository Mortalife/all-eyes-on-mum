import type {
  LinkedEntityType,
  ReminderFrequency,
} from "../../types/reminder.ts";
import { defineCommand } from "../cqrs/index.ts";
import { createNotification } from "../notifications/index.ts";
import {
  createReminder,
  deleteReminder,
  pauseReminder,
  resumeReminder,
  triggerReminder,
  updateReminder,
} from "./index.ts";

type CreateReminderInput = {
  title: string;
  description?: string | null;
  frequency: ReminderFrequency;
  nextDue: string;
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string | null;
};

type UpdateReminderInput = {
  id: string;
  title?: string;
  description?: string | null;
  frequency?: ReminderFrequency;
  nextDue?: string;
  linkedEntityType?: LinkedEntityType;
  linkedEntityId?: string | null;
  isActive?: boolean;
};

type TriggerReminderInput = {
  id: string;
};

type DeleteReminderInput = {
  id: string;
};

// Creates a new reminder
export const createReminderCommand = defineCommand({
  type: "reminder.create",
  emits: "reminder.created",
  handler: async (user, data: CreateReminderInput) => {
    const reminder = await createReminder(data, user.id);
    await createNotification({
      userId: user.id,
      type: "success",
      title: "Reminder created",
      message: `${data.title} has been added.`,
    });
    return { success: true, reminder };
  },
});

// Updates an existing reminder
export const updateReminderCommand = defineCommand({
  type: "reminder.update",
  emits: "reminder.updated",
  handler: async (user, data: UpdateReminderInput) => {
    const { id, ...updateData } = data;
    const reminder = await updateReminder(id, updateData);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Reminder updated",
      message: `${updateData.title || "Reminder"} has been updated.`,
    });
    return { success: !!reminder, reminder };
  },
});

// Triggers a reminder (marks as done and advances next due).
// Note: triggerReminder() already creates its own notification internally.
export const triggerReminderCommand = defineCommand({
  type: "reminder.trigger",
  emits: "reminder.triggered",
  handler: async (user, data: TriggerReminderInput) => {
    const reminder = await triggerReminder(data.id, user.id);
    return { success: !!reminder, reminder };
  },
});

// Pauses a reminder
export const pauseReminderCommand = defineCommand({
  type: "reminder.pause",
  emits: "reminder.paused",
  handler: async (user, data: { id: string }) => {
    const reminder = await pauseReminder(data.id);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Reminder paused",
      message: `${reminder?.title || "Reminder"} has been paused.`,
    });
    return { success: !!reminder, reminder };
  },
});

// Resumes a reminder
export const resumeReminderCommand = defineCommand({
  type: "reminder.resume",
  emits: "reminder.resumed",
  handler: async (user, data: { id: string }) => {
    const reminder = await resumeReminder(data.id);
    await createNotification({
      userId: user.id,
      type: "success",
      title: "Reminder resumed",
      message: `${reminder?.title || "Reminder"} has been resumed.`,
    });
    return { success: !!reminder, reminder };
  },
});

// Deletes a reminder
export const deleteReminderCommand = defineCommand({
  type: "reminder.delete",
  emits: "reminder.deleted",
  handler: async (user, data: DeleteReminderInput) => {
    const success = await deleteReminder(data.id);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Reminder deleted",
      message: "The reminder has been removed.",
    });
    return { success, id: data.id };
  },
});
