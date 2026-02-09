import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import {
  createAppointmentCommand,
  deleteAppointmentCommand,
  updateAppointmentCommand,
} from "../../lib/appointments/commands.ts";
import {
  getAllAppointments,
  getAppointment,
  getPastAppointments,
  getUpcomingAppointments,
} from "../../lib/appointments/index.ts";
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
import type { Appointment, AppointmentType } from "../../types/appointment.ts";
import type { HonoContext } from "../../types/hono.ts";
import { Button, Card, FormField, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";

export const appointmentsRouter = new Hono<HonoContext>();

// Appointment form validation schema
const appointmentFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z
    .string()
    .optional()
    .transform((val) => val || null),
  datetime: z.string().min(1, "Date and time is required"),
  endTime: z
    .string()
    .optional()
    .transform((val) => val || null),
  location: z
    .string()
    .optional()
    .transform((val) => val || null),
  type: z.enum(["medical", "home", "financial", "social", "other"]),
  reminderDays: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === "") return 1;
      const num = parseInt(val, 10);
      return isNaN(num) ? 1 : num;
    }),
});

// Type display labels
const TYPE_LABELS: Record<AppointmentType, string> = {
  medical: "Medical",
  home: "Home",
  financial: "Financial",
  social: "Social",
  other: "Other",
};

// Type badge classes
const TYPE_BADGE_CLASSES: Record<AppointmentType, string> = {
  medical: "badge-error",
  home: "badge-info",
  financial: "badge-success",
  social: "badge-secondary",
  other: "badge-ghost",
};

// Returns the status of an appointment based on datetime
const getAppointmentStatus = (
  datetime: string,
): { label: string; class: string } => {
  const now = new Date();
  const appointmentDate = new Date(datetime);

  if (appointmentDate < now) {
    return { label: "Past", class: "badge-ghost" };
  }

  const diffHours =
    (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours <= 24) {
    return { label: "Today/Tomorrow", class: "badge-warning" };
  }
  if (diffHours <= 168) {
    // 7 days
    return { label: "This Week", class: "badge-info" };
  }
  return { label: "Upcoming", class: "badge-success" };
};

// Formats a datetime for display (e.g., "Mon 15 Jan at 2:30 PM")
const formatDateTime = (datetimeStr: string): string => {
  const date = new Date(datetimeStr);
  const dayName = date.toLocaleDateString("en-GB", { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  const time = date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dayName} ${day} ${month} at ${time}`;
};

// Formats datetime for input field (datetime-local format)
const formatDateTimeForInput = (datetimeStr: string): string => {
  const date = new Date(datetimeStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

// Renders a type badge
const TypeBadge = (type: AppointmentType) => html`
  <span class="badge ${TYPE_BADGE_CLASSES[type]}">${TYPE_LABELS[type]}</span>
`;

// Renders a single appointment card
const AppointmentCard = (appointment: Appointment) => {
  const status = getAppointmentStatus(appointment.datetime);
  const isMedical = appointment.type === "medical";

  return html`
    <a
      href="/app/appointments/${appointment.id}"
      class="${`card bg-base-100 shadow-sm hover:shadow-md transition-shadow border ${isMedical ? "border-error/30" : "border-base-300"}`}"
    >
      <div class="card-body p-4">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h3 class="font-medium truncate">${appointment.title}</h3>
            <p class="text-sm text-base-content/70 mt-1">
              ${formatDateTime(appointment.datetime)}
            </p>
            ${appointment.location
              ? html`
                  <p class="text-sm text-base-content/60 mt-1 truncate">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 inline-block mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    ${appointment.location}
                  </p>
                `
              : ""}
          </div>
          <div class="flex flex-col items-end gap-1">
            ${TypeBadge(appointment.type)}
            <span class="badge badge-sm ${status.class}">${status.label}</span>
          </div>
        </div>
      </div>
    </a>
  `;
};

// Renders the appointments list
const AppointmentsList = (
  appointments: Appointment[],
  title: string,
  emptyMessage: string,
) => {
  if (appointments.length === 0) {
    return html`
      <div class="text-center py-8">
        <p class="text-base-content/50">${emptyMessage}</p>
      </div>
    `;
  }

  return html`
    <div class="space-y-3">${appointments.map(AppointmentCard)}</div>
  `;
};

// Renders the appointment form (create/edit)
const AppointmentForm = (props: {
  appointment?: Appointment;
  action: string;
  submitLabel: string;
  errors: FormErrors | null;
}) => {
  const { appointment, action, submitLabel, errors } = props;

  return html`
    ${errors?.formErrors?.length
      ? html`<div class="alert alert-error mb-4">${errors.formErrors[0]}</div>`
      : ""}
    <form
      data-on:submit="@post('${action}')"
      data-signals="${JSON.stringify({
        title: appointment?.title || "",
        description: appointment?.description || "",
        datetime: appointment?.datetime
          ? formatDateTimeForInput(appointment.datetime)
          : "",
        endTime: appointment?.endTime
          ? formatDateTimeForInput(appointment.endTime)
          : "",
        location: appointment?.location || "",
        type: appointment?.type || "other",
        reminderDays: appointment?.reminderDays?.toString() || "1",
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
            />
          `,
        })}
        ${FormField({
          label: "Type",
          htmlFor: "type",
          error: errors?.fieldErrors?.type?.[0],
          children: html`
            <select
              id="type"
              name="type"
              class="select select-bordered w-full"
              data-bind="type"
              required
            >
              <option value="medical">Medical</option>
              <option value="home">Home</option>
              <option value="financial">Financial</option>
              <option value="social">Social</option>
              <option value="other">Other</option>
            </select>
          `,
        })}
        ${FormField({
          label: "Date & Time",
          htmlFor: "datetime",
          error: errors?.fieldErrors?.datetime?.[0],
          children: html`
            <input
              type="datetime-local"
              id="datetime"
              name="datetime"
              class="input input-bordered w-full"
              data-bind="datetime"
              required
            />
          `,
        })}
        ${FormField({
          label: "End Time (optional)",
          htmlFor: "endTime",
          error: errors?.fieldErrors?.endTime?.[0],
          children: html`
            <input
              type="datetime-local"
              id="endTime"
              name="endTime"
              class="input input-bordered w-full"
              data-bind="endTime"
            />
          `,
        })}
        ${FormField({
          label: "Location (optional)",
          htmlFor: "location",
          error: errors?.fieldErrors?.location?.[0],
          children: html`
            <input
              type="text"
              id="location"
              name="location"
              class="input input-bordered w-full"
              data-bind="location"
              placeholder="e.g., Dr Smith's Surgery, 123 High St"
            />
          `,
        })}
        ${FormField({
          label: "Reminder Days Before",
          htmlFor: "reminderDays",
          error: errors?.fieldErrors?.reminderDays?.[0],
          children: html`
            <input
              type="number"
              id="reminderDays"
              name="reminderDays"
              class="input input-bordered w-full"
              data-bind="reminderDays"
              min="0"
              max="30"
            />
          `,
        })}

        <div class="md:col-span-2">
          ${FormField({
            label: "Description (optional)",
            htmlFor: "description",
            error: errors?.fieldErrors?.description?.[0],
            children: html`
              <textarea
                id="description"
                name="description"
                class="textarea textarea-bordered w-full"
                data-bind="description"
                rows="3"
              ></textarea>
            `,
          })}
        </div>
      </div>

      <div class="mt-6 flex gap-2">
        ${Button({ type: "submit", children: submitLabel })}
        ${Button({
          variant: "ghost",
          href: "/app/appointments",
          children: "Cancel",
        })}
      </div>
    </form>
  `;
};

// Delete confirmation modal
const DeleteConfirmModal = (appointment: Appointment) => {
  return html`
    <dialog id="delete-modal" class="modal">
      <div
        class="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <h3 id="delete-modal-title" class="font-bold text-lg">
          Delete Appointment
        </h3>
        <p class="py-4">
          Are you sure you want to delete <strong>${appointment.title}</strong>?
        </p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost">Cancel</button>
          </form>
          <button
            type="button"
            class="btn btn-error"
            data-on:click="@post('/app/appointments/${appointment.id}/delete')"
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
type AppointmentsPageState = {
  upcomingAppointments: Appointment[];
  pastAppointments: Appointment[];
};

type AppointmentDetailPageState = {
  appointment: Appointment;
};

// Appointments list content renderer
const renderAppointmentsContent = (state: AppointmentsPageState) => html`
  <div id="appointments-content">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Upcoming Appointments -->
      <div class="lg:col-span-2">
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title">
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Upcoming Appointments
            </h2>
            ${state.upcomingAppointments.length === 0
              ? html`
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
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 class="text-lg font-medium text-base-content/70">
                      No upcoming appointments
                    </h3>
                    <p class="text-base-content/50 mt-1">
                      Add an appointment to start tracking.
                    </p>
                  </div>
                `
              : AppointmentsList(
                  state.upcomingAppointments,
                  "Upcoming",
                  "No upcoming appointments",
                )}
          </div>
        </div>
      </div>

      <!-- Past Appointments -->
      <div>
        <div class="card bg-base-100 shadow-xl">
          <div class="card-body">
            <h2 class="card-title text-base">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-base-content/50"
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
              Past Appointments
            </h2>
            ${state.pastAppointments.length === 0
              ? html`<p class="text-sm text-base-content/50">
                  No past appointments.
                </p>`
              : html`
                  <div class="space-y-2">
                    ${state.pastAppointments.map(
                      (apt) => html`
                        <a
                          href="/app/appointments/${apt.id}"
                          class="block p-2 rounded hover:bg-base-200 transition-colors"
                        >
                          <div class="flex items-center justify-between">
                            <span class="text-sm font-medium truncate"
                              >${apt.title}</span
                            >
                            ${TypeBadge(apt.type)}
                          </div>
                          <p class="text-xs text-base-content/60">
                            ${formatDate(apt.datetime)}
                          </p>
                        </a>
                      `,
                    )}
                  </div>
                `}
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// Appointments list page
appointmentsRouter.get("/", async (c) => {
  const user = c.get("user")!;
  const [upcomingAppointments, pastAppointments, notifications, unreadCount] =
    await Promise.all([
      getUpcomingAppointments(30),
      getPastAppointments(10),
      getNotifications(user.id, 5),
      getUnreadCount(user.id),
    ]);

  return c.html(
    AppLayout({
      title: "Appointments - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Appointments",
          description: "Track where Mum needs to be and when",
        })}
        <div class="mb-6">
          ${Button({
            href: "/app/appointments/new",
            children: "Add Appointment",
          })}
        </div>
        <div data-init="@get('/app/appointments/sse')">
          ${renderAppointmentsContent({
            upcomingAppointments,
            pastAppointments,
          })}
        </div>
      `,
    }),
  );
});

// Appointments SSE endpoint
appointmentsRouter.get(
  "/sse",
  createSSEResource({
    loadState: async (): Promise<AppointmentsPageState> => {
      const [upcomingAppointments, pastAppointments] = await Promise.all([
        getUpcomingAppointments(30),
        getPastAppointments(10),
      ]);
      return { upcomingAppointments, pastAppointments };
    },
    render: renderAppointmentsContent,
    eventTypes: ["appointment.*"],
  }),
);

// Form state type for create/edit pages
type AppointmentFormPageState = {
  appointment?: Appointment;
  action: string;
  submitLabel: string;
  formErrors: FormErrors | null;
};

// Appointment form content renderer (used by SSE for create/edit pages)
const renderAppointmentFormContent = (state: AppointmentFormPageState) => html`
  <div id="appointment-form-content">
    ${Card({
      children: html`
        <div class="card-body">
          ${AppointmentForm({
            appointment: state.appointment,
            action: state.action,
            submitLabel: state.submitLabel,
            errors: state.formErrors,
          })}
        </div>
      `,
    })}
  </div>
`;

// Appointment form resource (handles SSE + create POST for the form)
const appointmentFormResource = createFormResource({
  path: "/app/appointments/form/sse",
  schema: appointmentFormSchema,
  command: createAppointmentCommand,
  data: (parsed) => ({
    ...parsed,
    datetime: new Date(parsed.datetime).toISOString(),
    endTime: parsed.endTime ? new Date(parsed.endTime).toISOString() : null,
  }),
  eventTypes: ["appointment.*"],
  successRedirect: "/app/appointments",
  loadState: async (_user, c, cid) => {
    const editId = c.req.query("editId");
    const appointment = editId ? await getAppointment(editId) : undefined;
    return {
      appointment: appointment || undefined,
      action: editId ? `/app/appointments/${editId}` : "/app/appointments",
      submitLabel: editId ? "Save Changes" : "Add Appointment",
      formErrors: formErrorStore.getErrors(cid),
    };
  },
  render: renderAppointmentFormContent,
});

appointmentsRouter.post("/form/sse", appointmentFormResource.sseHandler);

// New appointment page
appointmentsRouter.get("/new", async (c) => {
  const user = c.get("user")!;
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  return c.html(
    AppLayout({
      title: "Add Appointment - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Add New Appointment",
          description: "Schedule an appointment to track",
        })}
        ${appointmentFormResource.container(
          renderAppointmentFormContent({
            action: "/app/appointments",
            submitLabel: "Add Appointment",
            formErrors: null,
          }),
        )}
      `,
    }),
  );
});

// Create appointment
appointmentsRouter.post("/", appointmentFormResource.postHandler);

// Appointment detail content renderer
const renderAppointmentDetailContent = (state: AppointmentDetailPageState) => {
  const { appointment } = state;
  const status = getAppointmentStatus(appointment.datetime);
  const isMedical = appointment.type === "medical";

  return html`
    <div id="appointment-detail-content">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <div
            class="${`card bg-base-100 shadow-xl ${isMedical ? "border-2 border-error/30" : ""}`}"
          >
            <div class="card-body">
              <div class="flex items-start justify-between">
                <div>
                  <h2 class="card-title text-2xl">${appointment.title}</h2>
                  <div class="flex items-center gap-2 mt-1">
                    ${TypeBadge(appointment.type)}
                    <span class="badge ${status.class}">${status.label}</span>
                  </div>
                </div>
              </div>

              <div class="divider"></div>

              <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-base-content/60">Date & Time</dt>
                  <dd class="text-lg font-semibold">
                    ${formatDateTime(appointment.datetime)}
                  </dd>
                </div>
                ${appointment.endTime
                  ? html`
                      <div>
                        <dt class="text-sm text-base-content/60">End Time</dt>
                        <dd class="text-lg font-semibold">
                          ${formatDateTime(appointment.endTime)}
                        </dd>
                      </div>
                    `
                  : ""}
                ${appointment.location
                  ? html`
                      <div class="md:col-span-2">
                        <dt class="text-sm text-base-content/60">Location</dt>
                        <dd class="text-lg">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-5 w-5 inline-block mr-1 text-base-content/60"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          ${appointment.location}
                        </dd>
                      </div>
                    `
                  : ""}
                <div>
                  <dt class="text-sm text-base-content/60">Reminder</dt>
                  <dd>
                    ${appointment.reminderDays}
                    day${appointment.reminderDays !== 1 ? "s" : ""} before
                  </dd>
                </div>
              </dl>

              ${appointment.description
                ? html`
                    <div class="divider"></div>
                    <div>
                      <h3 class="text-sm text-base-content/60 mb-1">
                        Description
                      </h3>
                      <p class="whitespace-pre-wrap">
                        ${appointment.description}
                      </p>
                    </div>
                  `
                : ""}

              <div class="divider"></div>

              <div class="flex gap-2">
                <a
                  href="/app/appointments/${appointment.id}/edit"
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
              <h3 class="card-title text-base">Details</h3>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <dt class="text-base-content/60">Type</dt>
                  <dd>${TYPE_LABELS[appointment.type]}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-base-content/60">Created</dt>
                  <dd>${formatDate(appointment.createdAt)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-base-content/60">Last Updated</dt>
                  <dd>${formatDate(appointment.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      ${DeleteConfirmModal(appointment)}
    </div>
  `;
};

// Appointment detail page
appointmentsRouter.get("/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [appointment, notifications, unreadCount] = await Promise.all([
    getAppointment(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!appointment) {
    return c.redirect("/app/appointments");
  }

  return c.html(
    AppLayout({
      title: `${appointment.title} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        <div class="mb-6">
          ${Button({
            href: "/app/appointments",
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
              Back to Appointments
            `,
          })}
        </div>
        <div data-init="@get('/app/appointments/${id}/sse')">
          ${renderAppointmentDetailContent({
            appointment,
          })}
        </div>
      `,
    }),
  );
});

// Appointment detail SSE endpoint
appointmentsRouter.get("/:id/sse", async (c) => {
  const id = c.req.param("id");

  return createSSEResource({
    loadState: async (): Promise<AppointmentDetailPageState> => {
      const appointment = await getAppointment(id);
      if (!appointment) {
        throw new Error("Appointment not found");
      }
      return { appointment };
    },
    render: renderAppointmentDetailContent,
    eventTypes: ["appointment.*"],
    errorRedirect: "/app/appointments",
  })(c);
});

// Edit appointment page
appointmentsRouter.get("/:id/edit", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [appointment, notifications, unreadCount] = await Promise.all([
    getAppointment(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!appointment) {
    return c.redirect("/app/appointments");
  }

  return c.html(
    AppLayout({
      title: `Edit ${appointment.title} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: `Edit ${appointment.title}`,
          description: "Update appointment details",
        })}
        ${appointmentFormResource.container(
          renderAppointmentFormContent({
            appointment,
            action: `/app/appointments/${id}`,
            submitLabel: "Save Changes",
            formErrors: null,
          }),
          `/app/appointments/form/sse?editId=${id}`,
        )}
      `,
    }),
  );
});

// Update appointment
appointmentsRouter.post(
  "/:id",
  handleFormPost({
    schema: appointmentFormSchema,
    command: updateAppointmentCommand,
    data: (parsed, c) => ({
      id: c.req.param("id"),
      ...parsed,
      datetime: new Date(parsed.datetime).toISOString(),
      endTime: parsed.endTime ? new Date(parsed.endTime).toISOString() : null,
    }),
  }),
);

// Delete appointment
appointmentsRouter.post("/:id/delete", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(deleteAppointmentCommand, user, { id });

  return c.body(null, 204);
});
