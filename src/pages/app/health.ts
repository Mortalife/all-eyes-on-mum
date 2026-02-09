import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import {
  createHealthNoteCommand,
  deleteHealthNoteCommand,
  updateHealthNoteCommand,
} from "../../lib/health-notes/commands.ts";
import {
  getAllHealthNotes,
  getHealthNote,
  getHealthNotesByCategory,
  searchHealthNotes,
} from "../../lib/health-notes/index.ts";
import {
  commandStore,
  createFormResource,
  createSSEResource,
  formErrorStore,
  handleFormPost,
} from "../../lib/cqrs/index.ts";
import type { FormErrors } from "../../lib/cqrs/form-errors.ts";
import {
  getNotifications,
  getUnreadCount,
} from "../../lib/notifications/index.ts";
import type {
  HealthNote,
  HealthNoteCategory,
} from "../../types/health-note.ts";
import type { HonoContext } from "../../types/hono.ts";
import { Button, Card, FormField, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";

export const healthRouter = new Hono<HonoContext>();

// Health note form validation schema
const healthNoteFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.enum(["medication", "gp-visit", "hospital", "general"]),
  date: z.string().min(1, "Date is required"),
});

// Category display labels
const CATEGORY_LABELS: Record<HealthNoteCategory, string> = {
  medication: "Medication",
  "gp-visit": "GP Visit",
  hospital: "Hospital",
  general: "General",
};

// Category badge classes
const CATEGORY_BADGE_CLASSES: Record<HealthNoteCategory, string> = {
  medication: "badge-success",
  "gp-visit": "badge-info",
  hospital: "badge-error",
  general: "badge-ghost",
};

// Formats a date for display
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Formats a date for display with day name
const formatDateWithDay = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Truncates text to a maximum length
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
};

// Renders a category badge
const CategoryBadge = (category: HealthNoteCategory) => html`
  <span class="badge ${CATEGORY_BADGE_CLASSES[category]}"
    >${CATEGORY_LABELS[category]}</span
  >
`;

// Renders a timeline item for a health note
const HealthNoteTimelineItem = (note: HealthNote) => {
  const isHospital = note.category === "hospital";

  return html`
    <div
      class="${`relative pl-8 pb-8 border-l-2 ${isHospital ? "border-error/50" : "border-base-300"} last:border-transparent`}"
    >
      <!-- Timeline dot -->
      <div
        class="${`absolute left-0 -translate-x-1/2 w-4 h-4 rounded-full ${isHospital ? "bg-error" : "bg-primary"}`}"
      ></div>

      <!-- Content card -->
      <a
        href="/app/health/${note.id}"
        class="${`card bg-base-100 shadow-sm hover:shadow-md transition-shadow ${isHospital ? "border border-error/30" : ""}`}"
      >
        <div class="card-body p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm text-base-content/60"
                  >${formatDateWithDay(note.date)}</span
                >
                ${CategoryBadge(note.category)}
              </div>
              <h3 class="font-medium">${note.title}</h3>
              <p class="text-sm text-base-content/70 mt-1 line-clamp-2">
                ${truncateText(note.content, 150)}
              </p>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-base-content/30 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </a>
    </div>
  `;
};

// Renders the timeline view of health notes
const HealthNotesTimeline = (notes: HealthNote[]) => {
  if (notes.length === 0) {
    return html`
      <div class="text-center py-12">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-16 w-16 mx-auto text-base-content/30 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="text-lg font-medium text-base-content/70">
          No health notes yet
        </h3>
        <p class="text-base-content/50 mt-1">
          Add your first health note to start tracking.
        </p>
      </div>
    `;
  }

  return html`
    <div class="relative ml-4">${notes.map(HealthNoteTimelineItem)}</div>
  `;
};

// Renders category filter tabs
const CategoryFilterTabs = (activeCategory: HealthNoteCategory | null) => {
  const categories: (HealthNoteCategory | null)[] = [
    null,
    "medication",
    "gp-visit",
    "hospital",
    "general",
  ];

  return html`
    <div role="tablist" class="tabs tabs-boxed bg-base-200 mb-4">
      ${categories.map(
        (cat) => html`
          <a
            href="${cat ? `/app/health?category=${cat}` : "/app/health"}"
            role="tab"
            class="tab ${activeCategory === cat ? "tab-active" : ""}"
          >
            ${cat ? CATEGORY_LABELS[cat] : "All"}
          </a>
        `,
      )}
    </div>
  `;
};

// Renders the search box
const SearchBox = (query: string) => html`
  <div
    class="mb-4"
    data-signals="${JSON.stringify({ searchQuery: query || "" })}"
  >
    <div class="join w-full max-w-md">
      <label for="search-input" class="sr-only">Search health notes</label>
      <input
        type="text"
        id="search-input"
        class="input input-bordered join-item flex-1"
        placeholder="Search notes..."
        data-bind="searchQuery"
        data-on:keydown="if (event.key === 'Enter') window.location.href = '/app/health?search=' + encodeURIComponent($searchQuery)"
      />
      <button
        type="button"
        class="btn btn-primary join-item"
        data-on:click="window.location.href = '/app/health?search=' + encodeURIComponent($searchQuery)"
        aria-label="Search"
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    </div>
    ${query
      ? html`
          <div class="mt-2">
            <span class="text-sm text-base-content/60"
              >Showing results for "${query}"</span
            >
            <a href="/app/health" class="btn btn-ghost btn-xs ml-2"
              >Clear search</a
            >
          </div>
        `
      : ""}
  </div>
`;

// Renders the health note form (create/edit)
const HealthNoteForm = (props: {
  note?: HealthNote;
  action: string;
  submitLabel: string;
  errors: FormErrors | null;
}) => {
  const { note, action, submitLabel, errors } = props;
  const today = new Date().toISOString().split("T")[0];

  return html`
    ${errors?.formErrors?.length
      ? html`<div class="alert alert-error mb-4">${errors.formErrors[0]}</div>`
      : ""}
    <form
      data-on:submit="@post('${action}')"
      data-signals="${JSON.stringify({
        title: note?.title || "",
        content: note?.content || "",
        category: note?.category || "general",
        date: note?.date || today,
      })}"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${FormField({
          label: "Title",
          htmlFor: "title",
          error: errors?.fieldErrors?.title?.[0],
          children: html`
            <input
              type="text"
              id="title"
              name="title"
              class="input input-bordered w-full"
              data-bind="title"
              required
              placeholder="e.g., GP appointment about blood pressure"
            />
          `,
        })}
        ${FormField({
          label: "Date",
          htmlFor: "date",
          error: errors?.fieldErrors?.date?.[0],
          children: html`
            <input
              type="date"
              id="date"
              name="date"
              class="input input-bordered w-full"
              data-bind="date"
              required
            />
          `,
        })}
        ${FormField({
          label: "Category",
          htmlFor: "category",
          error: errors?.fieldErrors?.category?.[0],
          children: html`
            <select
              id="category"
              name="category"
              class="select select-bordered w-full"
              data-bind="category"
              required
            >
              <option value="general">General</option>
              <option value="medication">Medication</option>
              <option value="gp-visit">GP Visit</option>
              <option value="hospital">Hospital</option>
            </select>
          `,
        })}

        <div class="md:col-span-2">
          ${FormField({
            label: "Content",
            htmlFor: "content",
            error: errors?.fieldErrors?.content?.[0],
            children: html`
              <textarea
                id="content"
                name="content"
                class="textarea textarea-bordered w-full"
                data-bind="content"
                rows="8"
                required
                placeholder="Record the details of the health event, medication changes, GP advice, etc."
              ></textarea>
            `,
          })}
        </div>
      </div>

      <div class="mt-6 flex gap-2">
        ${Button({ type: "submit", children: submitLabel })}
        ${Button({ variant: "ghost", href: "/app/health", children: "Cancel" })}
      </div>
    </form>
  `;
};

// Delete confirmation modal
const DeleteConfirmModal = (note: HealthNote) => {
  return html`
    <dialog id="delete-modal" class="modal">
      <div
        class="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <h3 id="delete-modal-title" class="font-bold text-lg">
          Delete Health Note
        </h3>
        <p class="py-4">
          Are you sure you want to delete <strong>${note.title}</strong>? This
          action cannot be undone.
        </p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost">Cancel</button>
          </form>
          <button
            type="button"
            class="btn btn-error"
            data-on:click="@post('/app/health/${note.id}/delete')"
          >
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  `;
};

// Page state type
type HealthPageState = {
  notes: HealthNote[];
  category: HealthNoteCategory | null;
  searchQuery: string;
};

type HealthNoteDetailPageState = {
  note: HealthNote;
};

// Health notes list content renderer
const renderHealthContent = (state: HealthPageState) => html`
  <div id="health-content">
    ${SearchBox(state.searchQuery)}
    ${!state.searchQuery ? CategoryFilterTabs(state.category) : ""}

    <div class="card bg-base-100 shadow-xl">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h2 class="card-title">
            ${state.searchQuery
              ? "Search Results"
              : state.category
                ? `${CATEGORY_LABELS[state.category]} Notes`
                : "Health Timeline"}
          </h2>
        </div>
        ${HealthNotesTimeline(state.notes)}
      </div>
    </div>
  </div>
`;

// Health notes list page
healthRouter.get("/", async (c) => {
  const user = c.get("user")!;
  const category = c.req.query("category") as HealthNoteCategory | undefined;
  const searchQuery = c.req.query("search") || "";

  let notes: HealthNote[];
  if (searchQuery) {
    notes = await searchHealthNotes(searchQuery);
  } else if (category) {
    notes = await getHealthNotesByCategory(category);
  } else {
    notes = await getAllHealthNotes();
  }

  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  return c.html(
    AppLayout({
      title: "Health Notes - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Health Notes",
          description: "A private record of health-related information",
        })}
        <div class="mb-6">
          ${Button({ href: "/app/health/new", children: "Add Note" })}
        </div>
        <div
          data-init="@get('/app/health/sse?category=${category ||
          ""}&search=${encodeURIComponent(searchQuery)}')"
        >
          ${renderHealthContent({
            notes,
            category: category || null,
            searchQuery,
          })}
        </div>
      `,
    }),
  );
});

// Health notes SSE endpoint
healthRouter.get("/sse", async (c) => {
  const category = c.req.query("category") as HealthNoteCategory | undefined;
  const searchQuery = c.req.query("search") || "";

  return createSSEResource({
    loadState: async (): Promise<HealthPageState> => {
      let notes: HealthNote[];
      if (searchQuery) {
        notes = await searchHealthNotes(searchQuery);
      } else if (category) {
        notes = await getHealthNotesByCategory(category);
      } else {
        notes = await getAllHealthNotes();
      }
      return { notes, category: category || null, searchQuery };
    },
    render: renderHealthContent,
    eventTypes: ["healthNote.*"],
  })(c);
});

// Form page state type for create/edit pages
type HealthNoteFormPageState = {
  note?: HealthNote;
  action: string;
  submitLabel: string;
  formErrors: FormErrors | null;
};

// Health note form content renderer (used by SSE for create/edit pages)
const renderHealthNoteFormContent = (state: HealthNoteFormPageState) => html`
  <div id="health-form-content">
    ${Card({
      children: html`
        <div class="card-body">
          ${HealthNoteForm({
            note: state.note,
            action: state.action,
            submitLabel: state.submitLabel,
            errors: state.formErrors,
          })}
        </div>
      `,
    })}
  </div>
`;

// Health note form resource (manages SSE + POST for create/edit)
const healthNoteFormResource = createFormResource({
  path: "/app/health/form/sse",
  schema: healthNoteFormSchema,
  command: createHealthNoteCommand,
  eventTypes: ["healthNote.*"],
  successRedirect: "/app/health",
  loadState: async (_user, c, cid) => {
    const editId = c.req.query("editId");
    const note = editId ? await getHealthNote(editId) : undefined;
    return {
      note: note || undefined,
      action: editId ? `/app/health/${editId}` : "/app/health",
      submitLabel: editId ? "Save Changes" : "Add Note",
      formErrors: formErrorStore.getErrors(cid),
    };
  },
  render: renderHealthNoteFormContent,
});

healthRouter.post("/form/sse", healthNoteFormResource.sseHandler);

// New health note page
healthRouter.get("/new", async (c) => {
  const user = c.get("user")!;
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  return c.html(
    AppLayout({
      title: "Add Health Note - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Add Health Note",
          description:
            "Record health information like medication changes, GP visits, or hospital stays",
        })}
        ${healthNoteFormResource.container(
          renderHealthNoteFormContent({
            action: "/app/health",
            submitLabel: "Add Note",
            formErrors: null,
          }),
        )}
      `,
    }),
  );
});

// Create health note
healthRouter.post("/", healthNoteFormResource.postHandler);

// Health note detail content renderer
const renderHealthNoteDetailContent = (state: HealthNoteDetailPageState) => {
  const { note } = state;
  const isHospital = note.category === "hospital";

  return html`
    <div id="health-note-detail-content">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <div
            class="${`card bg-base-100 shadow-xl ${isHospital ? "border-2 border-error/30" : ""}`}"
          >
            <div class="card-body">
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    ${CategoryBadge(note.category)}
                    <span class="text-sm text-base-content/60"
                      >${formatDateWithDay(note.date)}</span
                    >
                  </div>
                  <h2 class="card-title text-2xl">${note.title}</h2>
                </div>
              </div>

              <div class="divider"></div>

              <div class="prose max-w-none">
                <p class="whitespace-pre-wrap">${note.content}</p>
              </div>

              <div class="divider"></div>

              <div class="flex gap-2">
                <a href="/app/health/${note.id}/edit" class="btn btn-ghost"
                  >Edit</a
                >
                <button
                  type="button"
                  class="btn btn-ghost btn-error"
                  onclick="document.getElementById('delete-modal').showModal()"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h3 class="card-title text-base">Details</h3>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <dt class="text-base-content/60">Category</dt>
                  <dd>${CATEGORY_LABELS[note.category]}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-base-content/60">Date</dt>
                  <dd>${formatDate(note.date)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-base-content/60">Created</dt>
                  <dd>${formatDate(note.createdAt)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-base-content/60">Last Updated</dt>
                  <dd>${formatDate(note.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div class="card bg-base-200/50 shadow mt-4">
            <div class="card-body p-4">
              <div class="flex items-start gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-info shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <p class="text-xs text-base-content/60">
                  This health information is private and only visible to
                  authorised family members.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${DeleteConfirmModal(note)}
    </div>
  `;
};

// Health note detail page
healthRouter.get("/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [note, notifications, unreadCount] = await Promise.all([
    getHealthNote(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!note) {
    return c.redirect("/app/health");
  }

  return c.html(
    AppLayout({
      title: `${note.title} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        <div class="mb-6">
          ${Button({
            href: "/app/health",
            variant: "ghost",
            children: html`
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Health Notes
            `,
          })}
        </div>
        <div data-init="@get('/app/health/${id}/sse')">
          ${renderHealthNoteDetailContent({
            note,
          })}
        </div>
      `,
    }),
  );
});

// Health note detail SSE endpoint
healthRouter.get("/:id/sse", async (c) => {
  const id = c.req.param("id");

  return createSSEResource({
    loadState: async (): Promise<HealthNoteDetailPageState> => {
      const note = await getHealthNote(id);
      if (!note) throw new Error("Health note not found");
      return { note };
    },
    render: renderHealthNoteDetailContent,
    eventTypes: ["healthNote.*"],
    errorRedirect: "/app/health",
  })(c);
});

// Edit health note page
healthRouter.get("/:id/edit", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [note, notifications, unreadCount] = await Promise.all([
    getHealthNote(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!note) {
    return c.redirect("/app/health");
  }

  return c.html(
    AppLayout({
      title: `Edit ${note.title} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: `Edit Health Note`,
          description: "Update health note details",
        })}
        ${healthNoteFormResource.container(
          renderHealthNoteFormContent({
            note,
            action: `/app/health/${id}`,
            submitLabel: "Save Changes",
            formErrors: null,
          }),
          `/app/health/form/sse?editId=${id}`,
        )}
      `,
    }),
  );
});

// Update health note
healthRouter.post(
  "/:id",
  handleFormPost({
    schema: healthNoteFormSchema,
    command: updateHealthNoteCommand,
    data: (parsed, c) => ({ id: c.req.param("id"), ...parsed }),
  }),
);

// Delete health note
healthRouter.post("/:id/delete", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(deleteHealthNoteCommand, user, { id });

  return c.body(null, 204);
});
