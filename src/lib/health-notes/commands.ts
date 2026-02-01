import type { HealthNoteCategory } from "../../types/health-note.ts";
import { defineCommand } from "../cqrs/index.ts";
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
    return { success: true, healthNote };
  },
});

// Updates an existing health note
export const updateHealthNoteCommand = defineCommand({
  type: "healthNote.update",
  emits: "healthNote.updated",
  handler: async (_user, data: UpdateHealthNoteInput) => {
    const { id, ...updateData } = data;
    const healthNote = await updateHealthNote(id, updateData);
    return { success: !!healthNote, healthNote };
  },
});

// Deletes a health note
export const deleteHealthNoteCommand = defineCommand({
  type: "healthNote.delete",
  emits: "healthNote.deleted",
  handler: async (_user, data: DeleteHealthNoteInput) => {
    const success = await deleteHealthNote(data.id);
    return { success, id: data.id };
  },
});
