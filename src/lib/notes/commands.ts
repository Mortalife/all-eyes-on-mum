import { defineCommand } from "../cqrs/index.ts";
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
    return { success: true, note };
  },
});

// Marks a note as resolved
export const resolveNoteCommand = defineCommand({
  type: "note.resolve",
  emits: "note.resolved",
  handler: async (user, data: ResolveNoteInput) => {
    const note = await resolveNote(data.id, user.id);
    return { success: !!note, note };
  },
});

// Marks a note as unresolved
export const unresolveNoteCommand = defineCommand({
  type: "note.unresolve",
  emits: "note.unresolved",
  handler: async (_user, data: UnresolveNoteInput) => {
    const note = await unresolveNote(data.id);
    return { success: !!note, note };
  },
});

// Deletes a note
export const deleteNoteCommand = defineCommand({
  type: "note.delete",
  emits: "note.deleted",
  handler: async (_user, data: DeleteNoteInput) => {
    const success = await deleteNote(data.id);
    return { success, id: data.id };
  },
});
