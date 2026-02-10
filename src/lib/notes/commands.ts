import { defineCommand } from "../cqrs/index.ts";
import { createNotification } from "../notifications/index.ts";
import { createNote, deleteNote, resolveNote, unresolveNote } from "./index.ts";

type CreateNoteInput = {
  content: string;
};

type ResolveNoteInput = {
  id: string;
};

type UnresolveNoteInput = {
  id: string;
};

type DeleteNoteInput = {
  id: string;
};

// Creates a new note
export const createNoteCommand = defineCommand({
  type: "note.create",
  emits: "note.created",
  handler: async (user, data: CreateNoteInput) => {
    const note = await createNote(data.content, user.id);
    await createNotification({
      userId: user.id,
      type: "success",
      title: "Note added",
      message: "A new note has been created.",
    });
    return { success: true, note };
  },
});

// Marks a note as resolved
export const resolveNoteCommand = defineCommand({
  type: "note.resolve",
  emits: "note.resolved",
  handler: async (user, data: ResolveNoteInput) => {
    const note = await resolveNote(data.id, user.id);
    await createNotification({
      userId: user.id,
      type: "success",
      title: "Note resolved",
      message: "The note has been marked as resolved.",
    });
    return { success: !!note, note };
  },
});

// Marks a note as unresolved
export const unresolveNoteCommand = defineCommand({
  type: "note.unresolve",
  emits: "note.unresolved",
  handler: async (user, data: UnresolveNoteInput) => {
    const note = await unresolveNote(data.id);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Note reopened",
      message: "The note has been marked as unresolved.",
    });
    return { success: !!note, note };
  },
});

// Deletes a note
export const deleteNoteCommand = defineCommand({
  type: "note.delete",
  emits: "note.deleted",
  handler: async (user, data: DeleteNoteInput) => {
    const success = await deleteNote(data.id);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Note deleted",
      message: "The note has been removed.",
    });
    return { success, id: data.id };
  },
});
