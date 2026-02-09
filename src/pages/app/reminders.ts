import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import { getContract } from "../../lib/contracts/index.ts";
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
import {
  createReminderCommand,
  deleteReminderCommand,
  pauseReminderCommand,
  resumeReminderCommand,
  triggerReminderCommand,
  updateReminderCommand,
} from "../../lib/reminders/commands.ts";
import { getAllReminders, getReminder } from "../../lib/reminders/index.ts";
import type { Contract } from "../../types/contract.ts";
import type { HonoContext } from "../../types/hono.ts";
import type {
  LinkedEntityType,
  RecurringReminder,
  ReminderFrequency,
} from "../../types/reminder.ts";
import { Button, Card, FormField, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";

export const remindersRouter = new Hono<HonoContext>();

// Reminder form validation schema
const reminderFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z
    .string()
    .optional()
    .transform((val) => val || null),
  frequency: z.enum(["weekly", "monthly", "quarterly", "annually", "one-off"]),
  nextDue: z.string().min(1, "Next due date is required"),
  linkedEntityType: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(["contract"]).nullable().optional(),
  ),
  linkedEntityId: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().nullable().optional(),
  ),
});

// Frequency display labels
const FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
  "one-off": "One-off",
};

// Returns the status of a reminder based on next due date
const getReminderStatus = (
  nextDue: string,
  isActive: boolean,
): { label: string; class: string } => {
  if (!isActive) {
    return { label: "Paused", class: "badge-ghost" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextDue);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return { label: "Overdue", class: "badge-error" };
  }
  if (diffDays === 0) {
    return { label: "Due Today", class: "badge-warning" };
  }
  if (diffDays <= 7) {
    return { label: "Due Soon", class: "badge-info" };
  }
  return { label: "Scheduled", class: "badge-success" };
};

// Formats a date for display
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Renders a single reminder row in the table
const ReminderRow = (
  reminder: RecurringReminder,
  linkedContract: Contract | null,
) => {
  const status = getReminderStatus(reminder.nextDue, reminder.isActive);

  return html`
    <tr class="${reminder.isActive ? "" : "opacity-60"}">
      <td>
        <a
          href="/app/reminders/${reminder.id}"
          class="link link-hover font-medium"
        >
          ${reminder.title}
        </a>
        ${reminder.description
          ? html`<span class="text-sm text-base-content/60 block line-clamp-1"
              >${reminder.description}</span
            >`
          : ""}
      </td>
      <td>
        <span class="badge badge-outline"
          >${FREQUENCY_LABELS[reminder.frequency]}</span
        >
      </td>
      <td>${formatDate(reminder.nextDue)}</td>
      <td>
        ${linkedContract
          ? html`<a
              href="/app/contracts/${linkedContract.id}"
              class="link link-hover text-sm"
              >${linkedContract.name}</a
            >`
          : html`<span class="text-base-content/50">-</span>`}
      </td>
      <td><span class="badge ${status.class}">${status.label}</span></td>
      <td>
        <div class="flex gap-1">
          ${reminder.isActive
            ? html`
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  data-on:click="@post('/app/reminders/${reminder.id}/trigger')"
                  title="Mark as done"
                >
                  Done
                </button>
              `
            : ""}
          <a href="/app/reminders/${reminder.id}" class="btn btn-ghost btn-xs"
            >View</a
          >
        </div>
      </td>
    </tr>
  `;
};

// Renders the reminders table
const RemindersTable = (
  reminders: RecurringReminder[],
  contractsMap: Map<string, Contract>,
) => {
  if (reminders.length === 0) {
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 class="text-lg font-medium text-base-content/70">
          No reminders yet
        </h3>
        <p class="text-base-content/50 mt-1">
          Create recurring reminders to stay on top of tasks.
        </p>
      </div>
    `;
  }

  return html`
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Reminder</th>
            <th scope="col">Frequency</th>
            <th scope="col">Next Due</th>
            <th scope="col">Linked To</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          ${reminders.map((r) =>
            ReminderRow(
              r,
              r.linkedEntityId
                ? contractsMap.get(r.linkedEntityId) || null
                : null,
            ),
          )}
        </tbody>
      </table>
    </div>
  `;
};

// Renders the reminder form (create/edit)
const ReminderForm = (props: {
  reminder?: RecurringReminder;
  action: string;
  submitLabel: string;
  errors: FormErrors | null;
  prefill?: {
    title?: string;
    linkedEntityType?: string;
    linkedEntityId?: string;
  };
}) => {
  const { reminder, action, submitLabel, errors, prefill } = props;

  return html`
    ${errors?.formErrors?.length
      ? html`<div class="alert alert-error mb-4">${errors.formErrors[0]}</div>`
      : ""}
    <form
      data-on:submit="@post('${action}')"
      data-signals="${JSON.stringify({
        title: reminder?.title || prefill?.title || "",
        description: reminder?.description || "",
        frequency: reminder?.frequency || "monthly",
        nextDue: reminder?.nextDue || "",
        linkedEntityType:
          reminder?.linkedEntityType || prefill?.linkedEntityType || "",
        linkedEntityId:
          reminder?.linkedEntityId || prefill?.linkedEntityId || "",
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
              placeholder="e.g., Check gas meter, Review insurance"
            />
          `,
        })}
        ${FormField({
          label: "Frequency",
          htmlFor: "frequency",
          error: errors?.fieldErrors?.frequency?.[0],
          children: html`
            <select
              id="frequency"
              name="frequency"
              class="select select-bordered w-full"
              data-bind="frequency"
              required
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
              <option value="one-off">One-off</option>
            </select>
          `,
        })}
        ${FormField({
          label: "Next Due Date",
          htmlFor: "nextDue",
          error: errors?.fieldErrors?.nextDue?.[0],
          children: html`
            <input
              type="date"
              id="nextDue"
              name="nextDue"
              class="input input-bordered w-full"
              data-bind="nextDue"
              required
            />
          `,
        })}

        <div class="md:col-span-2">
          ${FormField({
            label: "Description",
            htmlFor: "description",
            error: errors?.fieldErrors?.description?.[0],
            children: html`
              <textarea
                id="description"
                name="description"
                class="textarea textarea-bordered w-full"
                data-bind="description"
                rows="3"
                placeholder="What needs to be done?"
              ></textarea>
            `,
          })}
        </div>

        <!-- Hidden fields for linked entity -->
        <input
          type="hidden"
          name="linkedEntityType"
          data-bind="linkedEntityType"
        />
        <input type="hidden" name="linkedEntityId" data-bind="linkedEntityId" />
      </div>

      <div class="mt-6 flex gap-2">
        ${Button({ type: "submit", children: submitLabel })}
        ${Button({
          variant: "ghost",
          href: "/app/reminders",
          children: "Cancel",
        })}
      </div>
    </form>
  `;
};

// Delete confirmation modal
const DeleteConfirmModal = (reminder: RecurringReminder) => {
  return html`
    <dialog id="delete-modal" class="modal">
      <div
        class="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <h3 id="delete-modal-title" class="font-bold text-lg">
          Delete Reminder
        </h3>
        <p class="py-4">
          Are you sure you want to delete <strong>${reminder.title}</strong>?
        </p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost">Cancel</button>
          </form>
          <button
            type="button"
            class="btn btn-error"
            data-on:click="@post('/app/reminders/${reminder.id}/delete')"
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
type RemindersPageState = {
  reminders: RecurringReminder[];
  contractsMap: Map<string, Contract>;
};

type ReminderDetailPageState = {
  reminder: RecurringReminder;
  linkedContract: Contract | null;
};

// Loads contracts for linked reminders
const loadLinkedContracts = async (
  reminders: RecurringReminder[],
): Promise<Map<string, Contract>> => {
  const contractIds = new Set<string>();
  for (const r of reminders) {
    if (r.linkedEntityType === "contract" && r.linkedEntityId) {
      contractIds.add(r.linkedEntityId);
    }
  }

  const contractsMap = new Map<string, Contract>();
  for (const id of contractIds) {
    const contract = await getContract(id);
    if (contract) {
      contractsMap.set(id, contract);
    }
  }

  return contractsMap;
};

// Reminders list content renderer
const renderRemindersContent = (state: RemindersPageState) => html`
  <div id="reminders-content">
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">
        ${RemindersTable(state.reminders, state.contractsMap)}
      </div>
    </div>
  </div>
`;

// Reminders list page
remindersRouter.get("/", async (c) => {
  const user = c.get("user")!;
  const [reminders, notifications, unreadCount] = await Promise.all([
    getAllReminders(),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  const contractsMap = await loadLinkedContracts(reminders);

  return c.html(
    AppLayout({
      title: "Reminders - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Reminders",
          description: "Recurring tasks and periodic checks",
        })}
        <div class="mb-6">
          ${Button({ href: "/app/reminders/new", children: "Add Reminder" })}
        </div>
        <div data-init="@get('/app/reminders/sse')">
          ${renderRemindersContent({ reminders, contractsMap })}
        </div>
      `,
    }),
  );
});

// Reminders SSE endpoint
remindersRouter.get(
  "/sse",
  createSSEResource({
    loadState: async (): Promise<RemindersPageState> => {
      const reminders = await getAllReminders();
      const contractsMap = await loadLinkedContracts(reminders);
      return { reminders, contractsMap };
    },
    render: renderRemindersContent,
    eventTypes: ["reminder.*", "contract.*"],
  }),
);

// Form state type for create/edit pages
type ReminderFormPageState = {
  reminder?: RecurringReminder;
  action: string;
  submitLabel: string;
  formErrors: FormErrors | null;
  prefill?: {
    title?: string;
    linkedEntityType?: string;
    linkedEntityId?: string;
  };
};

// Reminder form content renderer (used by SSE for create/edit pages)
const renderReminderFormContent = (state: ReminderFormPageState) => html`
  <div id="reminder-form-content">
    ${Card({
      children: html`
        <div class="card-body">
          ${ReminderForm({
            reminder: state.reminder,
            action: state.action,
            submitLabel: state.submitLabel,
            errors: state.formErrors,
            prefill: state.prefill,
          })}
        </div>
      `,
    })}
  </div>
`;

// Reminder form resource (handles SSE + POST for create)
const reminderFormResource = createFormResource({
  path: "/app/reminders/form/sse",
  schema: reminderFormSchema,
  command: createReminderCommand,
  eventTypes: ["reminder.*"],
  successRedirect: "/app/reminders",
  loadState: async (_user, c, cid) => {
    const editId = c.req.query("editId");
    const reminder = editId ? await getReminder(editId) : undefined;
    const prefillTitle = c.req.query("prefillTitle") || undefined;
    const prefillLinkedEntityType =
      c.req.query("prefillLinkedEntityType") || undefined;
    const prefillLinkedEntityId =
      c.req.query("prefillLinkedEntityId") || undefined;
    return {
      reminder: reminder || undefined,
      action: editId ? `/app/reminders/${editId}` : "/app/reminders",
      submitLabel: editId ? "Save Changes" : "Add Reminder",
      formErrors: formErrorStore.getErrors(cid),
      prefill:
        !editId &&
        (prefillTitle || prefillLinkedEntityType || prefillLinkedEntityId)
          ? {
              title: prefillTitle,
              linkedEntityType: prefillLinkedEntityType,
              linkedEntityId: prefillLinkedEntityId,
            }
          : undefined,
    };
  },
  render: renderReminderFormContent,
});

// Reminder form SSE endpoint (shared by create and edit pages)
remindersRouter.post("/form/sse", reminderFormResource.sseHandler);

// New reminder page
remindersRouter.get("/new", async (c) => {
  const user = c.get("user")!;
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  // Check for prefill from query params (when creating from contract page)
  const title = c.req.query("title") || undefined;
  const linkedEntityType = c.req.query("linkedEntityType") || undefined;
  const linkedEntityId = c.req.query("linkedEntityId") || undefined;

  const sseParams = new URLSearchParams();
  if (title) sseParams.set("prefillTitle", title);
  if (linkedEntityType)
    sseParams.set("prefillLinkedEntityType", linkedEntityType);
  if (linkedEntityId) sseParams.set("prefillLinkedEntityId", linkedEntityId);

  return c.html(
    AppLayout({
      title: "Add Reminder - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Add New Reminder",
          description: "Create a recurring reminder for periodic tasks",
        })}
        ${reminderFormResource.container(
          renderReminderFormContent({
            action: "/app/reminders",
            submitLabel: "Add Reminder",
            formErrors: null,
            prefill: { title, linkedEntityType, linkedEntityId },
          }),
          `/app/reminders/form/sse?${sseParams.toString()}`,
        )}
      `,
    }),
  );
});

// Create reminder
remindersRouter.post("/", reminderFormResource.postHandler);

// Reminder detail content renderer
const renderReminderDetailContent = (state: ReminderDetailPageState) => {
  const { reminder, linkedContract } = state;
  const status = getReminderStatus(reminder.nextDue, reminder.isActive);

  return html`
    <div id="reminder-detail-content">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <div class="flex items-start justify-between">
                <div>
                  <h2 class="card-title text-2xl">${reminder.title}</h2>
                  ${reminder.description
                    ? html`<p class="text-base-content/60 mt-1">
                        ${reminder.description}
                      </p>`
                    : ""}
                </div>
                <span class="badge ${status.class} badge-lg"
                  >${status.label}</span
                >
              </div>

              <div class="divider"></div>

              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-base-content/60">Frequency</dt>
                  <dd class="text-lg">
                    ${FREQUENCY_LABELS[reminder.frequency]}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-base-content/60">Next Due</dt>
                  <dd class="text-lg font-semibold">
                    ${formatDate(reminder.nextDue)}
                  </dd>
                </div>
                ${reminder.lastTriggered
                  ? html`
                      <div>
                        <dt class="text-sm text-base-content/60">
                          Last Completed
                        </dt>
                        <dd>${formatDate(reminder.lastTriggered)}</dd>
                      </div>
                    `
                  : ""}
                ${linkedContract
                  ? html`
                      <div>
                        <dt class="text-sm text-base-content/60">Linked To</dt>
                        <dd>
                          <a
                            href="/app/contracts/${linkedContract.id}"
                            class="link link-primary"
                            >${linkedContract.name}</a
                          >
                        </dd>
                      </div>
                    `
                  : ""}
              </dl>

              <div class="divider"></div>

              <div class="flex flex-wrap gap-2">
                ${reminder.isActive
                  ? html`
                      <button
                        type="button"
                        class="btn btn-primary"
                        data-on:click="@post('/app/reminders/${reminder.id}/trigger')"
                      >
                        Mark as Done
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost"
                        data-on:click="@post('/app/reminders/${reminder.id}/pause')"
                      >
                        Pause
                      </button>
                    `
                  : html`
                      <button
                        type="button"
                        class="btn btn-primary"
                        data-on:click="@post('/app/reminders/${reminder.id}/resume')"
                      >
                        Resume
                      </button>
                    `}
                <a
                  href="/app/reminders/${reminder.id}/edit"
                  class="btn btn-ghost"
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
              <h3 class="card-title">About Reminders</h3>
              <p class="text-sm text-base-content/60">
                When you mark a reminder as done, it will automatically
                reschedule based on its frequency.
              </p>
              <p class="text-sm text-base-content/60 mt-2">
                One-off reminders will be deactivated after completion.
              </p>
            </div>
          </div>
        </div>
      </div>

      ${DeleteConfirmModal(reminder)}
    </div>
  `;
};

// Reminder detail page
remindersRouter.get("/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [reminder, notifications, unreadCount] = await Promise.all([
    getReminder(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!reminder) {
    return c.redirect("/app/reminders");
  }

  let linkedContract: Contract | null = null;
  if (reminder.linkedEntityType === "contract" && reminder.linkedEntityId) {
    linkedContract = await getContract(reminder.linkedEntityId);
  }

  return c.html(
    AppLayout({
      title: `${reminder.title} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        <div class="mb-6">
          ${Button({
            href: "/app/reminders",
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
              Back to Reminders
            `,
          })}
        </div>
        <div data-init="@get('/app/reminders/${id}/sse')">
          ${renderReminderDetailContent({
            reminder,
            linkedContract,
          })}
        </div>
      `,
    }),
  );
});

// Reminder detail SSE endpoint
remindersRouter.get(
  "/:id/sse",
  createSSEResource({
    loadState: async (_user, c): Promise<ReminderDetailPageState> => {
      const id = c.req.param("id");
      const reminder = await getReminder(id);
      if (!reminder) {
        throw new Error("Reminder not found");
      }

      let linkedContract: Contract | null = null;
      if (reminder.linkedEntityType === "contract" && reminder.linkedEntityId) {
        linkedContract = await getContract(reminder.linkedEntityId);
      }

      return {
        reminder,
        linkedContract,
      };
    },
    render: renderReminderDetailContent,
    eventTypes: ["reminder.*", "contract.*"],
    errorRedirect: "/app/reminders",
  }),
);

// Edit reminder page
remindersRouter.get("/:id/edit", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [reminder, notifications, unreadCount] = await Promise.all([
    getReminder(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!reminder) {
    return c.redirect("/app/reminders");
  }

  return c.html(
    AppLayout({
      title: `Edit ${reminder.title} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: `Edit ${reminder.title}`,
          description: "Update reminder details",
        })}
        ${reminderFormResource.container(
          renderReminderFormContent({
            reminder,
            action: `/app/reminders/${id}`,
            submitLabel: "Save Changes",
            formErrors: null,
          }),
          `/app/reminders/form/sse?editId=${id}`,
        )}
      `,
    }),
  );
});

// Update reminder
remindersRouter.post(
  "/:id",
  handleFormPost({
    schema: reminderFormSchema,
    command: updateReminderCommand,
    data: (parsed, c) => ({ id: c.req.param("id"), ...parsed }),
  }),
);

// Trigger reminder (mark as done)
remindersRouter.post("/:id/trigger", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(triggerReminderCommand, user, { id });

  return c.body(null, 204);
});

// Pause reminder
remindersRouter.post("/:id/pause", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(pauseReminderCommand, user, { id });

  return c.body(null, 204);
});

// Resume reminder
remindersRouter.post("/:id/resume", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(resumeReminderCommand, user, { id });

  return c.body(null, 204);
});

// Delete reminder
remindersRouter.post("/:id/delete", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(deleteReminderCommand, user, { id });

  return c.body(null, 204);
});
