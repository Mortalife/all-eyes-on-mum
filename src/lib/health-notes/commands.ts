import type { HealthNoteCategory } from "../../types/health-note.ts";
import { defineCommand } from "../cqrs/index.ts";
import { createNotification } from "../notifications/index.ts";
import {
  createHealthNote,
  deleteHealthNote,
  updateHealthNote,
} from "./index.ts";

type CreateHealthNoteInput = {
  title: string;
  content: string;
  category: HealthNoteCategory;
  date: string;
};

type UpdateHealthNoteInput = {
  id: string;
  title?: string;
  content?: string;
  category?: HealthNoteCategory;
  date?: string;
};

type DeleteHealthNoteInput = {
  id: string;
};

// Creates a new health note
export const createHealthNoteCommand = defineCommand({
  type: "healthNote.create",
  emits: "healthNote.created",
  handler: async (user, data: CreateHealthNoteInput) => {
    const healthNote = await createHealthNote(data, user.id);
    await createNotification({
      userId: user.id,
      type: "success",
      title: "Health note added",
      message: `${data.title} has been recorded.`,
    });
    return { success: true, healthNote };
  },
});

// Updates an existing health note
export const updateHealthNoteCommand = defineCommand({
  type: "healthNote.update",
  emits: "healthNote.updated",
  handler: async (user, data: UpdateHealthNoteInput) => {
    const { id, ...updateData } = data;
    const healthNote = await updateHealthNote(id, updateData);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Health note updated",
      message: `${updateData.title || "Health note"} has been updated.`,
    });
    return { success: !!healthNote, healthNote };
  },
});

// Deletes a health note
export const deleteHealthNoteCommand = defineCommand({
  type: "healthNote.delete",
  emits: "healthNote.deleted",
  handler: async (user, data: DeleteHealthNoteInput) => {
    const success = await deleteHealthNote(data.id);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Health note deleted",
      message: "The health note has been removed.",
    });
    return { success, id: data.id };
  },
});
