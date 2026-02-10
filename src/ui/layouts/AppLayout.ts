import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { Notification } from "../../types/notification.ts";
import type { User } from "../../types/user.ts";
import { BaseLayout } from "./BaseLayout.ts";

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

// Renders a single notification item in the dropdown
const NotificationItem = (notification: Notification) => html`
  <div
    class="${`flex items-start gap-3 p-3 hover:bg-base-200 rounded-lg ${notification.read ? "opacity-60" : ""}`}"
  >
    <div class="shrink-0">${getNotificationIcon(notification.type)}</div>
    <div class="flex-1 min-w-0">
      ${notification.title
        ? html`<p class="text-sm font-medium">${notification.title}</p>`
        : ""}
      <p class="text-sm text-base-content/70 line-clamp-2">
        ${notification.message}
      </p>
      <p class="text-xs text-base-content/50 mt-1">
        ${formatTimeAgo(notification.createdAt)}
      </p>
    </div>
    <button
      type="button"
      class="btn btn-ghost btn-xs btn-circle"
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
`;

// Renders the notification bell with badge and dropdown (SSE-patchable)
export const NotificationBell = (
  notifications: Notification[],
  unreadCount: number,
) => html`
  <div id="notification-bell" class="dropdown dropdown-end">
    <div
      tabindex="0"
      role="button"
      class="btn btn-ghost btn-circle"
      aria-label="Notifications"
      aria-expanded="false"
    >
      <div class="indicator">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
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
        ${unreadCount > 0
          ? html`<span class="badge badge-primary badge-xs indicator-item"
              >${unreadCount > 99 ? "99+" : unreadCount}</span
            >`
          : ""}
      </div>
    </div>
    ${NotificationDropdown(notifications, unreadCount)}
  </div>
`;

// Renders the notification dropdown content
const NotificationDropdown = (
  notifications: Notification[],
  unreadCount: number,
) => html`
  <div
    class="dropdown-content bg-base-100 rounded-box z-10 mt-3 w-80 shadow-lg border border-base-300"
  >
    <div class="p-3 border-b border-base-300 flex items-center justify-between">
      <h3 class="font-semibold">Notifications</h3>
      ${unreadCount > 0
        ? html`
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              data-on:click="@post('/app/notifications/read-all')"
            >
              Mark all read
            </button>
          `
        : ""}
    </div>
    <div class="max-h-96 overflow-y-auto">
      ${notifications.length > 0
        ? notifications.map(NotificationItem)
        : html`
            <div class="p-6 text-center text-base-content/50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-8 w-8 mx-auto mb-2 opacity-50"
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
              <p class="text-sm">No notifications</p>
            </div>
          `}
    </div>
    <div class="p-2 border-t border-base-300">
      <a
        href="/app/notifications"
        class="btn btn-ghost btn-sm btn-block justify-start"
      >
        View all notifications
      </a>
    </div>
  </div>
`;

type AppLayoutProps = {
  title: string;
  user: User;
  children: HtmlEscapedString | Promise<HtmlEscapedString>;
  notifications?: Notification[];
  unreadCount?: number;
};

// App layout with navigation for authenticated users
export const AppLayout = ({
  title,
  user,
  children,
  notifications = [],
  unreadCount = 0,
}: AppLayoutProps) => {
  return BaseLayout({
    title,
    children: html`
      <div class="drawer lg:drawer-open">
        <input id="drawer" type="checkbox" class="drawer-toggle" />
        <div class="drawer-content flex flex-col">
          <!-- Navbar -->
          <header class="navbar bg-base-100 border-b border-base-300">
            <div class="flex-none lg:hidden">
              <label
                for="drawer"
                aria-label="Open sidebar"
                class="btn btn-square btn-ghost"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  class="inline-block h-6 w-6 stroke-current"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  ></path>
                </svg>
              </label>
            </div>
            <div class="flex-1">
              <span class="text-xl font-bold">All Eyes on Mum</span>
            </div>
            <div class="flex-none flex items-center gap-2">
              <!-- Notification bell (SSE-updated) -->
              <div data-init="@get('/app/notifications/bell')">
                ${NotificationBell(notifications, unreadCount)}
              </div>

              <!-- User menu -->
              <div class="dropdown dropdown-end">
                <div
                  tabindex="0"
                  role="button"
                  class="btn btn-ghost btn-circle avatar placeholder"
                >
                  <div
                    class="bg-primary text-primary-content w-10 rounded-full flex items-center justify-center"
                  >
                    <span>${user.name?.[0] || user.email[0]}</span>
                  </div>
                </div>
                <ul
                  tabindex="0"
                  class="menu menu-sm dropdown-content bg-base-100 rounded-box z-10 mt-3 w-52 p-2 shadow"
                >
                  <li><a href="/app/settings">Settings</a></li>
                  <li><a href="/auth/logout">Logout</a></li>
                </ul>
              </div>
            </div>
          </header>

          <!-- Main content -->
          <main class="flex-1 p-6">${children}</main>
        </div>

        <!-- Sidebar -->
        <div class="drawer-side">
          <label
            for="drawer"
            aria-label="Close sidebar"
            class="drawer-overlay"
          ></label>
          <nav
            class="menu bg-base-100 w-64 min-h-full p-4 border-r border-base-300"
          >
            <ul>
              <li><a href="/app">Dashboard</a></li>
              <li><a href="/app/contracts">Contracts</a></li>
              <li><a href="/app/reminders">Reminders</a></li>
              <li><a href="/app/appointments">Appointments</a></li>
              <li><a href="/app/health">Health</a></li>
              <li><a href="/app/notes">Notes</a></li>
              <li><a href="/app/observations">Observations</a></li>
            </ul>
            ${user.role === "admin"
              ? html`
                  <div class="divider"></div>
                  <p
                    class="text-xs font-semibold text-base-content/50 px-4 mb-2"
                  >
                    Admin
                  </p>
                  <ul>
                    <li><a href="/admin/users">Manage Users</a></li>
                  </ul>
                `
              : ""}
          </nav>
        </div>
      </div>
    `,
  });
};
