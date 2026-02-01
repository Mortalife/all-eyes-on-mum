import { Hono } from "hono";
import { html } from "hono/html";
import { getUpcomingAppointments } from "../../lib/appointments/index.ts";
import {
  getExpiringContracts,
  getTotalMonthlyExpenditure,
} from "../../lib/contracts/index.ts";
import { commandStore, createSSEResource } from "../../lib/cqrs/index.ts";
import { getActiveNotes } from "../../lib/notes/index.ts";
import { createNoteCommand } from "../../lib/notes/commands.ts";
import {
  getNotifications,
  getUnreadCount,
} from "../../lib/notifications/index.ts";
import { getAllObservations } from "../../lib/observations/index.ts";
import { getDueReminders } from "../../lib/reminders/index.ts";
import type { Appointment, AppointmentType } from "../../types/appointment.ts";
import type { Contract } from "../../types/contract.ts";
import type { HonoContext } from "../../types/hono.ts";
import type { Note } from "../../types/note.ts";
import type {
  Observation,
  ObservationCategory,
} from "../../types/observation.ts";
import type { RecurringReminder } from "../../types/reminder.ts";
import { Card, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";
import { appointmentsRouter } from "./appointments.ts";
import { contractsRouter } from "./contracts.ts";
import { healthRouter } from "./health.ts";
import { notesRouter } from "./notes.ts";
import { notificationsRouter } from "./notifications.ts";
import { observationsRouter } from "./observations.ts";
import { remindersRouter } from "./reminders.ts";

export const appRouter = new Hono<HonoContext>();

// Auth guard middleware
appRouter.use("*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.redirect("/");
  }
  await next();
});

// Mount notifications router
appRouter.route("/notifications", notificationsRouter);

// Mount contracts router
appRouter.route("/contracts", contractsRouter);

// Mount reminders router
appRouter.route("/reminders", remindersRouter);

// Mount appointments router
appRouter.route("/appointments", appointmentsRouter);

// Mount health router
appRouter.route("/health", healthRouter);

// Mount notes router
appRouter.route("/notes", notesRouter);

// Mount observations router
appRouter.route("/observations", observationsRouter);

// Dashboard state type
type DashboardState = {
  expiringContracts: Contract[];
  totalMonthlyExpenditure: number;
  dueReminders: RecurringReminder[];
  upcomingAppointments: Appointment[];
  recentNotes: Note[];
  recentObservations: Observation[];
};

// Formats a date for display
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

// Formats currency for display
const formatCurrency = (amount: number | null): string => {
  if (amount === null) return "Varies";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
};

// Returns a relative day label for appointments
const getRelativeDayLabel = (
  datetime: string,
): { label: string; isUrgent: boolean } => {
  const now = new Date();
  const appointmentDate = new Date(datetime);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const appointmentDay = new Date(
    appointmentDate.getFullYear(),
    appointmentDate.getMonth(),
    appointmentDate.getDate(),
  );

  const diffDays = Math.floor(
    (appointmentDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return { label: "Today", isUrgent: true };
  }
  if (diffDays === 1) {
    return { label: "Tomorrow", isUrgent: true };
  }
  return { label: formatDate(datetime), isUrgent: false };
};

// Returns the days until a date
const getDaysUntil = (dateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
};

// Type badge classes for appointments
const TYPE_BADGE_CLASSES: Record<AppointmentType, string> = {
  medical: "badge-error",
  home: "badge-info",
  financial: "badge-success",
  social: "badge-secondary",
  other: "badge-ghost",
};

// Type labels for appointments
const TYPE_LABELS: Record<AppointmentType, string> = {
  medical: "Medical",
  home: "Home",
  financial: "Financial",
  social: "Social",
  other: "Other",
};

// Category labels for observations
const OBSERVATION_CATEGORY_LABELS: Record<ObservationCategory, string> = {
  routine: "Routine",
  mood: "Mood",
  physical: "Physical",
  home: "Home",
  other: "Other",
};

// Dashboard state loader
const loadDashboardState = async (): Promise<DashboardState> => {
  const [
    expiringContracts,
    totalMonthlyExpenditure,
    dueReminders,
    upcomingAppointments,
    allNotes,
    allObservations,
  ] = await Promise.all([
    getExpiringContracts(30),
    getTotalMonthlyExpenditure(),
    getDueReminders(),
    getUpcomingAppointments(7),
    getActiveNotes(),
    getAllObservations(),
  ]);

  return {
    expiringContracts,
    totalMonthlyExpenditure,
    dueReminders,
    upcomingAppointments,
    recentNotes: allNotes.slice(0, 5),
    recentObservations: allObservations.slice(0, 3),
  };
};

// Renders the contracts overview widget
const ContractsWidget = (
  expiringContracts: Contract[],
  totalMonthly: number,
) => {
  return Card({
    children: html`
      <div class="card-body">
        <div class="flex items-center justify-between mb-2">
          <h2 class="card-title text-base">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
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
            Contracts
          </h2>
          <a href="/app/contracts" class="link link-primary text-sm"
            >View all</a
          >
        </div>

        <div class="stat p-2">
          <div class="stat-title text-xs">Monthly Expenditure</div>
          <div class="stat-value text-lg text-primary">
            ${formatCurrency(totalMonthly)}
          </div>
        </div>

        ${expiringContracts.length > 0
          ? html`
              <div class="mt-2">
                <p class="text-sm font-medium text-warning mb-2">
                  ${expiringContracts.length}
                  contract${expiringContracts.length !== 1 ? "s" : ""} expiring
                  soon
                </p>
                <ul class="space-y-2" role="list">
                  ${expiringContracts.slice(0, 3).map((contract) => {
                    const daysUntil = getDaysUntil(contract.contractEndDate!);
                    return html`
                      <li>
                        <a
                          href="/app/contracts/${contract.id}"
                          class="flex items-center justify-between p-2 rounded hover:bg-base-200 transition-colors"
                        >
                          <div class="flex-1 min-w-0">
                            <span class="font-medium truncate block"
                              >${contract.name}</span
                            >
                            <span class="text-sm text-base-content/60"
                              >${formatCurrency(
                                contract.monthlyAmount,
                              )}/mo</span
                            >
                          </div>
                          <span class="badge badge-warning badge-sm">
                            ${daysUntil <= 7
                              ? `${daysUntil}d`
                              : formatDate(contract.contractEndDate!)}
                          </span>
                        </a>
                      </li>
                    `;
                  })}
                </ul>
              </div>
            `
          : html`
              <p class="text-sm text-base-content/60 mt-2">
                No contracts expiring soon.
              </p>
            `}
      </div>
    `,
  });
};

// Renders the due reminders widget
const DueRemindersWidget = (reminders: RecurringReminder[]) => {
  return Card({
    children: html`
      <div class="card-body">
        <div class="flex items-center justify-between mb-2">
          <h2 class="card-title text-base">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
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
            ${reminders.length > 0
              ? `${reminders.length} reminder${reminders.length !== 1 ? "s" : ""} due`
              : "Reminders"}
          </h2>
          <a href="/app/reminders" class="link link-primary text-sm"
            >View all</a
          >
        </div>

        ${reminders.length === 0
          ? html`
              <div class="text-center py-4">
                <p class="text-base-content/60 text-sm">
                  No reminders due - you're all caught up!
                </p>
              </div>
            `
          : html`
              <ul class="space-y-2" role="list">
                ${reminders.slice(0, 4).map((reminder) => {
                  const daysUntil = getDaysUntil(reminder.nextDue);
                  const isOverdue = daysUntil < 0;
                  return html`
                    <li>
                      <a
                        href="/app/reminders/${reminder.id}"
                        class="flex items-center justify-between p-2 rounded hover:bg-base-200 transition-colors"
                      >
                        <div class="flex-1 min-w-0">
                          <span class="font-medium truncate block"
                            >${reminder.title}</span
                          >
                        </div>
                        ${isOverdue
                          ? html`<span class="badge badge-error badge-sm"
                              >Overdue</span
                            >`
                          : daysUntil === 0
                            ? html`<span class="badge badge-warning badge-sm"
                                >Today</span
                              >`
                            : ""}
                      </a>
                    </li>
                  `;
                })}
              </ul>
            `}
      </div>
    `,
  });
};

// Renders the upcoming appointments widget
const UpcomingAppointmentsWidget = (appointments: Appointment[]) => {
  const headerText =
    appointments.length === 0
      ? "Appointments"
      : `${appointments.length} upcoming appointment${appointments.length !== 1 ? "s" : ""}`;

  return Card({
    children: html`
      <div class="card-body">
        <div class="flex items-center justify-between mb-2">
          <h2 class="card-title text-base">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
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
            ${headerText}
          </h2>
          <a href="/app/appointments" class="link link-primary text-sm"
            >View all</a
          >
        </div>

        ${appointments.length === 0
          ? html`
              <div class="text-center py-6">
                <p class="text-base-content/60">No appointments this week.</p>
              </div>
            `
          : html`
              <ul class="space-y-2" role="list">
                ${appointments.map((apt) => {
                  const { label: dayLabel, isUrgent } = getRelativeDayLabel(
                    apt.datetime,
                  );
                  const time = new Date(apt.datetime).toLocaleTimeString(
                    "en-GB",
                    {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    },
                  );

                  return html`
                    <li>
                      <a
                        href="/app/appointments/${apt.id}"
                        class="flex items-center justify-between p-2 rounded hover:bg-base-200 transition-colors ${apt.type ===
                        "medical"
                          ? "border-l-2 border-error"
                          : ""}"
                      >
                        <div class="flex-1 min-w-0">
                          <span class="font-medium truncate block"
                            >${apt.title}</span
                          >
                          <span class="text-sm text-base-content/60"
                            >${time}</span
                          >
                        </div>
                        <div class="flex items-center gap-2">
                          <span
                            class="badge ${TYPE_BADGE_CLASSES[
                              apt.type
                            ]} badge-sm"
                            >${TYPE_LABELS[apt.type]}</span
                          >
                          ${isUrgent
                            ? html`<span class="badge badge-warning badge-sm"
                                >${dayLabel}</span
                              >`
                            : html`<span class="text-sm text-base-content/60"
                                >${dayLabel}</span
                              >`}
                        </div>
                      </a>
                    </li>
                  `;
                })}
              </ul>
            `}
      </div>
    `,
  });
};

// Renders the recent notes widget with quick-add form
const RecentNotesWidget = (notes: Note[]) => {
  return Card({
    children: html`
      <div class="card-body">
        <div class="flex items-center justify-between mb-2">
          <h2 class="card-title text-base">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Recent Notes
          </h2>
          <a href="/app/notes" class="link link-primary text-sm">View all</a>
        </div>

        <!-- Quick add form -->
        <form
          class="mb-3"
          data-on:submit="@post('/app/notes/quick-add')"
          data-signals="${JSON.stringify({ quickNoteContent: "" })}"
        >
          <div class="join w-full">
            <label for="quick-note-input" class="sr-only">Quick note</label>
            <input
              type="text"
              id="quick-note-input"
              class="input input-bordered join-item flex-1 input-sm"
              placeholder="Add a quick note..."
              data-bind="quickNoteContent"
              autocomplete="off"
            />
            <button type="submit" class="btn btn-primary btn-sm join-item">
              Add
            </button>
          </div>
        </form>

        ${notes.length === 0
          ? html`
              <div class="text-center py-4">
                <p class="text-base-content/60 text-sm">No active notes.</p>
              </div>
            `
          : html`
              <ul class="space-y-2" role="list">
                ${notes.map(
                  (note) => html`
                    <li class="p-2 bg-base-200 rounded text-sm">
                      <p class="line-clamp-2">${note.content}</p>
                      <p class="text-xs text-base-content/50 mt-1">
                        ${formatDate(note.createdAt)}
                      </p>
                    </li>
                  `,
                )}
              </ul>
            `}
      </div>
    `,
  });
};

// Renders the recent observations widget
const RecentObservationsWidget = (observations: Observation[]) => {
  return Card({
    children: html`
      <div class="card-body">
        <div class="flex items-center justify-between mb-2">
          <h2 class="card-title text-base">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            Recent Observations
          </h2>
          <a href="/app/observations" class="link link-primary text-sm"
            >View all</a
          >
        </div>

        ${observations.length === 0
          ? html`
              <div class="text-center py-4">
                <p class="text-base-content/60 text-sm">No observations yet.</p>
                <a
                  href="/app/observations/new"
                  class="btn btn-ghost btn-sm mt-2"
                  >Add observation</a
                >
              </div>
            `
          : html`
              <ul class="space-y-3" role="list">
                ${observations.map(
                  (obs) => html`
                    <li class="border-l-2 border-base-300 pl-3">
                      <p class="text-sm line-clamp-2">${obs.content}</p>
                      <div class="flex items-center gap-2 mt-1">
                        <span class="badge badge-ghost badge-sm"
                          >${OBSERVATION_CATEGORY_LABELS[obs.category]}</span
                        >
                        <span class="text-xs text-base-content/50"
                          >${formatDate(obs.observedAt)}</span
                        >
                      </div>
                    </li>
                  `,
                )}
              </ul>
              <div class="mt-3">
                <a
                  href="/app/observations/new"
                  class="btn btn-ghost btn-sm btn-block"
                  >Add observation</a
                >
              </div>
            `}
      </div>
    `,
  });
};

// Dashboard content renderer (used by both GET and SSE)
const renderDashboardContent = (state: DashboardState) => html`
  <div id="dashboard-content">
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <!-- Contracts Overview - top left -->
      <div>
        ${ContractsWidget(
          state.expiringContracts,
          state.totalMonthlyExpenditure,
        )}
      </div>

      <!-- Due Reminders - top middle -->
      <div>${DueRemindersWidget(state.dueReminders)}</div>

      <!-- Upcoming Appointments - top right -->
      <div>${UpcomingAppointmentsWidget(state.upcomingAppointments)}</div>

      <!-- Recent Notes - bottom left -->
      <div>${RecentNotesWidget(state.recentNotes)}</div>

      <!-- Recent Observations - bottom right -->
      <div>${RecentObservationsWidget(state.recentObservations)}</div>
    </div>
  </div>
`;

// Dashboard page
appRouter.get("/", async (c) => {
  const user = c.get("user")!;
  const [state, notifications, unreadCount] = await Promise.all([
    loadDashboardState(),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  return c.html(
    AppLayout({
      title: "Dashboard - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Dashboard",
          description: "Quick overview of what needs attention",
        })}
        <div data-init="@get('/app/sse')">${renderDashboardContent(state)}</div>
      `,
    }),
  );
});

// SSE endpoint for real-time updates
appRouter.get(
  "/sse",
  createSSEResource({
    loadState: loadDashboardState,
    render: renderDashboardContent,
    eventTypes: [
      "contract.*",
      "reminder.*",
      "appointment.*",
      "note.*",
      "observation.*",
    ],
  }),
);

// Quick add note endpoint
appRouter.post("/notes/quick-add", async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();

  const content = body.quickNoteContent?.trim();
  if (!content) {
    return c.body(null, 204);
  }

  commandStore.enqueue(createNoteCommand, user, { content });

  return c.body(null, 204);
});
