import { Hono } from "hono";
import { html } from "hono/html";
import { commandStore, createSSEResource } from "../../lib/cqrs/index.ts";
import {
  clearAllNotificationsCommand,
  dismissNotificationCommand,
  markAllNotificationsReadCommand,
  markNotificationReadCommand,
} from "../../lib/notifications/commands.ts";
import {
  getNotifications,
  getUnreadCount,
} from "../../lib/notifications/index.ts";
import type { Notification } from "../../types/notification.ts";
import type { HonoContext } from "../../types/hono.ts";
import { Button, Card, PageHeader } from "../../ui/index.ts";
import { AppLayout, NotificationBell } from "../../ui/layouts/index.ts";

export const notificationsRouter = new Hono<HonoContext>();

// Formats a date as relative time (e.g., "2 hours ago")
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// Returns the icon HTML for a notification type
const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "success":
      return html`<svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 text-success"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>`;
    case "error":
      return html`<svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 text-error"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>`;
    case "warning":
      return html`<svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 text-warning"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>`;
    case "info":
      return html`<svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 text-info"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>`;
  }
};

// Renders a single notification item for the full page list
const NotificationListItem = (notification: Notification) => html`
  <div
    class="flex items-start gap-4 p-4 rounded-lg ${notification.read
      ? "opacity-60"
      : "bg-base-200/50"}"
  >
    <div class="shrink-0 mt-0.5">${getNotificationIcon(notification.type)}</div>
    <div class="flex-1 min-w-0">
      ${notification.title
        ? html`<p class="font-medium">${notification.title}</p>`
        : ""}
      <p class="text-sm text-base-content/70">${notification.message}</p>
      <div class="flex items-center gap-3 mt-1">
        <span class="text-xs text-base-content/50">
          ${formatTimeAgo(notification.createdAt)}
        </span>
        ${notification.actionUrl
          ? html`<a
              href="${notification.actionUrl}"
              class="text-xs link link-primary"
              >View</a
            >`
          : ""}
      </div>
    </div>
    <div class="flex items-center gap-1 shrink-0">
      ${!notification.read
        ? html`
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              aria-label="Mark as read"
              data-on:click="@post('/app/notifications/${notification.id}/read')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
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
          `
        : ""}
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        aria-label="Dismiss notification"
        data-on:click="@post('/app/notifications/${notification.id}/dismiss')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
`;

// Page state type
type NotificationsPageState = {
  notifications: Notification[];
  unreadCount: number;
};

// Content renderer (SSE-compatible fragment with stable id)
const renderNotificationsContent = (state: NotificationsPageState) => html`
  <div id="notifications-content">
    ${state.notifications.length > 0
      ? html`
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm text-base-content/60">
              ${state.unreadCount > 0
                ? `${state.unreadCount} unread`
                : "All caught up"}
            </p>
            <div class="flex gap-2">
              ${state.unreadCount > 0
                ? html`
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      data-on:click="@post('/app/notifications/read-all')"
                    >
                      Mark all read
                    </button>
                  `
                : ""}
              <button
                type="button"
                class="btn btn-ghost btn-sm text-error"
                data-on:click="@post('/app/notifications/clear-all')"
              >
                Clear all
              </button>
            </div>
          </div>
          ${Card({
            children: html`
              <div class="divide-y divide-base-300">
                ${state.notifications.map(NotificationListItem)}
              </div>
            `,
          })}
        `
      : html`
          <div class="text-center py-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-12 w-12 mx-auto mb-4 text-base-content/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p class="text-base-content/50">No notifications yet</p>
          </div>
        `}
  </div>
`;

// Notifications page
notificationsRouter.get("/", async (c) => {
  const user = c.get("user")!;

  const [notifications, unreadCount, headerNotifications] = await Promise.all([
    getNotifications(user.id, 50),
    getUnreadCount(user.id),
    getNotifications(user.id, 5),
  ]);

  return c.html(
    AppLayout({
      title: "Notifications - All Eyes on Mum",
      user,
      notifications: headerNotifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Notifications",
          description: "View and manage your notifications",
        })}
        <div data-init="@get('/app/notifications/sse')">
          ${renderNotificationsContent({ notifications, unreadCount })}
        </div>
      `,
    }),
  );
});

// SSE endpoint for the notification bell in the header (global, all pages)
notificationsRouter.get(
  "/bell",
  createSSEResource({
    loadState: async (user) => {
      const [notifications, unreadCount] = await Promise.all([
        getNotifications(user.id, 5),
        getUnreadCount(user.id),
      ]);
      return { notifications, unreadCount };
    },
    render: (state) => NotificationBell(state.notifications, state.unreadCount),
    eventTypes: ["notification.*"],
  }),
);

// SSE endpoint for real-time notification updates
notificationsRouter.get(
  "/sse",
  createSSEResource({
    loadState: async (user) => {
      const [notifications, unreadCount] = await Promise.all([
        getNotifications(user.id, 50),
        getUnreadCount(user.id),
      ]);
      return { notifications, unreadCount };
    },
    render: renderNotificationsContent,
    eventTypes: ["notification.*"],
  }),
);

// Marks a single notification as read
notificationsRouter.post("/:id/read", async (c) => {
  const user = c.get("user")!;
  const notificationId = c.req.param("id");

  commandStore.enqueue(markNotificationReadCommand, user, {
    notificationId,
    userId: user.id,
  });

  return c.body(null, 204);
});

// Marks all notifications as read
notificationsRouter.post("/read-all", async (c) => {
  const user = c.get("user")!;

  commandStore.enqueue(markAllNotificationsReadCommand, user, {
    userId: user.id,
  });

  return c.body(null, 204);
});

// Dismisses a single notification
notificationsRouter.post("/:id/dismiss", async (c) => {
  const user = c.get("user")!;
  const notificationId = c.req.param("id");

  commandStore.enqueue(dismissNotificationCommand, user, {
    notificationId,
    userId: user.id,
  });

  return c.body(null, 204);
});

// Clears all notifications
notificationsRouter.post("/clear-all", async (c) => {
  const user = c.get("user")!;

  commandStore.enqueue(clearAllNotificationsCommand, user, {
    userId: user.id,
  });

  return c.body(null, 204);
});
