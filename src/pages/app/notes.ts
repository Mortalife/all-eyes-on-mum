import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import { findUserById } from "../../lib/auth/index.ts";
import { commandStore, createSSEResource } from "../../lib/cqrs/index.ts";
import {
  createNoteCommand,
  deleteNoteCommand,
  resolveNoteCommand,
  unresolveNoteCommand,
} from "../../lib/notes/commands.ts";
import { getActiveNotes, getResolvedNotes } from "../../lib/notes/index.ts";
import {
  getNotifications,
  getUnreadCount,
} from "../../lib/notifications/index.ts";
import type { HonoContext } from "../../types/hono.ts";
import type { Note } from "../../types/note.ts";
import type { User } from "../../types/user.ts";
import { Button, Card, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";

export const notesRouter = new Hono<HonoContext>();

// Note form validation schema
const noteFormSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

// Formats a date as relative time (e.g., "2 hours ago")
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (seconds < 604800) {
    const days = Math.floor(seconds / 86400);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Formats a date for grouping (e.g., "Today", "Yesterday", or "Mon 27 Jan")
const formatDateGroup = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const noteDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const diffDays = Math.floor(
    (today.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

// Gets date key for grouping
const getDateKey = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

// Type for note with author info
type NoteWithAuthor = Note & {
  authorName: string;
  resolverName?: string;
};

// Loads author information for notes
const loadNotesWithAuthors = async (
  notes: Note[],
): Promise<NoteWithAuthor[]> => {
  const userIds = new Set<string>();
  for (const note of notes) {
    userIds.add(note.createdBy);
    if (note.resolvedBy) {
      userIds.add(note.resolvedBy);
    }
  }

  const users = new Map<string, User>();
  for (const userId of userIds) {
    const user = await findUserById(userId);
    if (user) {
      users.set(userId, user);
    }
  }

  return notes.map((note) => {
    const author = users.get(note.createdBy);
    const resolver = note.resolvedBy ? users.get(note.resolvedBy) : undefined;
    return {
      ...note,
      authorName: author?.name || author?.email || "Unknown",
      resolverName: resolver?.name || resolver?.email,
    };
  });
};

// Groups notes by date
const groupNotesByDate = (
  notes: NoteWithAuthor[],
): Map<string, NoteWithAuthor[]> => {
  const groups = new Map<string, NoteWithAuthor[]>();

  for (const note of notes) {
    const key = getDateKey(note.createdAt);
    const existing = groups.get(key) || [];
    existing.push(note);
    groups.set(key, existing);
  }

  return groups;
};

// Renders the quick add form
const QuickAddForm = () => html`
  <div class="mb-6" data-signals="${JSON.stringify({ content: "" })}">
    <form data-on:submit="@post('/app/notes')" class="flex gap-2">
      <label for="note-content" class="sr-only">Add a quick note</label>
      <input
        type="text"
        id="note-content"
        name="content"
        class="input input-bordered flex-1"
        placeholder="Add a quick note... (e.g., Boiler's making a noise)"
        data-bind="content"
        autofocus
      />
      ${Button({ type: "submit", children: "Add" })}
    </form>
  </div>
`;

// Renders a single note item
const NoteItem = (note: NoteWithAuthor) => {
  return html`
    <div
      class="${`flex items-start gap-3 p-4 bg-base-100 rounded-lg border ${note.resolved ? "opacity-60 border-base-300" : "border-base-200 shadow-sm"}`}"
    >
      <div class="flex-1 min-w-0">
        <p class="${note.resolved ? "line-through text-base-content/70" : ""}">
          ${note.content}
        </p>
        <p class="text-sm text-base-content/50 mt-1">
          ${note.authorName}, ${formatTimeAgo(note.createdAt)}
          ${note.resolved && note.resolverName
            ? html` - resolved by ${note.resolverName}`
            : ""}
        </p>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        ${note.resolved
          ? html`
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-circle"
                aria-label="Mark as unresolved"
                title="Undo resolve"
                data-on:click="@post('/app/notes/${note.id}/unresolve')"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
              </button>
            `
          : html`
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-circle text-success"
                aria-label="Mark as resolved"
                title="Resolve"
                data-on:click="@post('/app/notes/${note.id}/resolve')"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>
            `}
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle text-error"
          aria-label="Delete note"
          title="Delete"
          data-on:click="@post('/app/notes/${note.id}/delete')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  `;
};

// Renders a grouped list of active notes
const ActiveNotesList = (notes: NoteWithAuthor[]) => {
  if (notes.length === 0) {
    return html`
      <div class="text-center py-8 text-base-content/50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 mx-auto mb-3 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p>No active notes</p>
        <p class="text-sm mt-1">Add a quick note above to get started.</p>
      </div>
    `;
  }

  const groups = groupNotesByDate(notes);
  const sortedKeys = Array.from(groups.keys()).sort().reverse();

  return html`
    <div class="space-y-6">
      ${sortedKeys.map((key) => {
        const groupNotes = groups.get(key)!;
        const dateLabel = formatDateGroup(groupNotes[0].createdAt);
        return html`
          <div>
            <h3 class="text-sm font-medium text-base-content/60 mb-2">
              ${dateLabel}
            </h3>
            <div class="space-y-2">${groupNotes.map(NoteItem)}</div>
          </div>
        `;
      })}
    </div>
  `;
};

// Renders the resolved notes section (collapsible)
const ResolvedNotesSection = (notes: NoteWithAuthor[]) => {
  if (notes.length === 0) {
    return "";
  }

  return html`
    <div class="collapse collapse-arrow bg-base-200/50 mt-6">
      <input
        type="checkbox"
        name="resolved-notes-accordion"
        id="resolved-notes-accordion"
      />
      <label
        for="resolved-notes-accordion"
        class="collapse-title font-medium text-base-content/70"
      >
        Resolved notes (${notes.length})
      </label>
      <div class="collapse-content">
        <div class="space-y-2 pt-2">${notes.map(NoteItem)}</div>
      </div>
    </div>
  `;
};

// Page state type
type NotesPageState = {
  activeNotes: NoteWithAuthor[];
  resolvedNotes: NoteWithAuthor[];
};

// Notes content renderer
const renderNotesContent = (state: NotesPageState) => html`
  <div id="notes-content">
    ${QuickAddForm()}
    ${Card({
      children: html`
        <div class="card-body">
          <div class="flex items-center gap-2 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            <h2 class="card-title">Active Notes</h2>
          </div>

          ${ActiveNotesList(state.activeNotes)}
          ${ResolvedNotesSection(state.resolvedNotes)}
        </div>
      `,
    })}
  </div>
`;

// Loads page state
const loadNotesPageState = async (): Promise<NotesPageState> => {
  const [activeNotes, resolvedNotes] = await Promise.all([
    getActiveNotes(),
    getResolvedNotes(20),
  ]);

  const [activeWithAuthors, resolvedWithAuthors] = await Promise.all([
    loadNotesWithAuthors(activeNotes),
    loadNotesWithAuthors(resolvedNotes),
  ]);

  return {
    activeNotes: activeWithAuthors,
    resolvedNotes: resolvedWithAuthors,
  };
};

// Notes list page
notesRouter.get("/", async (c) => {
  const user = c.get("user")!;

  const [state, notifications, unreadCount] = await Promise.all([
    loadNotesPageState(),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  return c.html(
    AppLayout({
      title: "Notes - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Shared Notes",
          description:
            "Quick notes for the family - things to remember, observations, reminders",
        })}
        <div data-init="@get('/app/notes/sse')">
          ${renderNotesContent(state)}
        </div>
      `,
    }),
  );
});

// Notes SSE endpoint
notesRouter.get(
  "/sse",
  createSSEResource({
    loadState: loadNotesPageState,
    render: renderNotesContent,
    eventTypes: ["note.*"],
  }),
);

// Create note
notesRouter.post("/", async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();

  const result = noteFormSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  commandStore.enqueue(createNoteCommand, user, {
    content: result.data.content,
  });

  return c.body(null, 204);
});

// Resolve note
notesRouter.post("/:id/resolve", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(resolveNoteCommand, user, { id });

  return c.body(null, 204);
});

// Unresolve note
notesRouter.post("/:id/unresolve", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(unresolveNoteCommand, user, { id });

  return c.body(null, 204);
});

// Delete note
notesRouter.post("/:id/delete", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(deleteNoteCommand, user, { id });

  return c.body(null, 204);
});
