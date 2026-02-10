import { Hono } from "hono";
import { html } from "hono/html";
import { Sidequest } from "sidequest";
import { z } from "zod";
import { DailyReminderJob } from "../../jobs/daily-reminder-job.ts";
import {
  createUserCommand,
  regenerateInviteCommand,
} from "../../lib/admin/commands.ts";
import type { InviteResult } from "../../lib/admin/invite-url-store.ts";
import { inviteUrlStore } from "../../lib/admin/invite-url-store.ts";
import {
  getAllUsersWithStatus,
  requireRole,
  type UserWithStatus,
} from "../../lib/auth/index.ts";
import {
  commandStore,
  createFormResource,
  formErrorStore,
} from "../../lib/cqrs/index.ts";
import type { FormErrors } from "../../lib/cqrs/form-errors.ts";
import {
  getNotifications,
  getUnreadCount,
} from "../../lib/notifications/index.ts";
import type { HonoContext } from "../../types/hono.ts";
import { Button, Card, FormField, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";

export const adminRouter = new Hono<HonoContext>();

// Require admin role for all admin routes
adminRouter.use("*", requireRole("admin"));

// Validation schema for creating users (no password - users set it via invite link)
const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
});

// Renders the users table with registration status
const UsersTable = ({ users }: { users: UserWithStatus[] }) => html`
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Created</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${users.map(
          (user) => html`
            <tr>
              <td>${user.name || "-"}</td>
              <td>${user.email}</td>
              <td>
                <span
                  class="badge ${user.role === "admin"
                    ? "badge-primary"
                    : "badge-ghost"}"
                >
                  ${user.role}
                </span>
              </td>
              <td>
                ${user.hasPassword
                  ? html`<span class="badge badge-success">Active</span>`
                  : html`<span class="badge badge-warning">Pending</span>`}
              </td>
              <td>${new Date(user.createdAt).toLocaleDateString()}</td>
              <td>
                ${!user.hasPassword
                  ? html`
                      <button
                        class="btn btn-xs btn-outline"
                        data-on:click="@post('/admin/users/${user.id}/invite')"
                      >
                        Generate Invite Link
                      </button>
                    `
                  : ""}
              </td>
            </tr>
          `,
        )}
      </tbody>
    </table>
  </div>
`;

// Create user form component (no password field — users set it via invite link)
const CreateUserForm = ({ errors }: { errors: FormErrors | null }) => html`
  ${errors?.formErrors?.length
    ? html`<div class="alert alert-error mb-4">${errors.formErrors[0]}</div>`
    : ""}
  <form
    data-on:submit="@post('/admin/users/create')"
    data-signals="${JSON.stringify({
      name: "",
      email: "",
    })}"
    class="space-y-4"
  >
    ${FormField({
      label: "Name",
      htmlFor: "name",
      error: errors?.fieldErrors?.name?.[0],
      children: html`
        <input
          type="text"
          id="name"
          name="name"
          class="input input-bordered w-full"
          data-bind="name"
          required
        />
      `,
    })}
    ${FormField({
      label: "Email",
      htmlFor: "email",
      error: errors?.fieldErrors?.email?.[0],
      children: html`
        <input
          type="email"
          id="email"
          name="email"
          class="input input-bordered w-full"
          data-bind="email"
          required
        />
      `,
    })}
    <p class="text-base-content/60 text-sm">
      An invite link will be generated for the user to set their own password.
    </p>
    <div class="form-control mt-4">
      ${Button({
        children: "Create User",
        type: "submit",
        variant: "primary",
      })}
    </div>
  </form>
`;

// Page state type
type AdminUsersPageState = {
  users: UserWithStatus[];
  formErrors: FormErrors | null;
  inviteResult: InviteResult | null;
};

// Renders the invite link alert
const InviteLinkAlert = ({
  inviteResult,
}: {
  inviteResult: InviteResult;
}) => html`
  <div class="alert alert-success mb-6" role="alert">
    <div>
      <p class="font-semibold mb-1">
        Invite link for ${inviteResult.userName}:
      </p>
      <code class="text-xs bg-base-100 px-2 py-1 rounded break-all select-all"
        >${inviteResult.inviteUrl}</code
      >
      <p class="text-xs mt-1 opacity-70">This link expires in 24 hours.</p>
    </div>
  </div>
`;

// Admin users content renderer (used by both GET and SSE)
const renderAdminUsersContent = (state: AdminUsersPageState) => html`
  <div id="admin-users-content">
    ${state.inviteResult
      ? InviteLinkAlert({ inviteResult: state.inviteResult })
      : ""}
    <div class="space-y-6">
      <!-- Create user form -->
      <div class="max-w-md">
        ${Card({
          children: html`
            <div class="card-body">
              <h2 class="card-title">Add Family Member</h2>
              ${CreateUserForm({
                errors: state.formErrors,
              })}
            </div>
          `,
        })}
      </div>

      <!-- Users list -->
      ${Card({
        children: html`
          <div class="card-body">
            <h2 class="card-title">Family Members</h2>
            ${state.users.length > 0
              ? UsersTable({ users: state.users })
              : html`<p class="text-base-content/60">No users yet</p>`}
          </div>
        `,
      })}
    </div>
  </div>
`;

// Loads page state
const loadAdminUsersState = async (
  connectionId: string,
  adminUserId: string,
): Promise<AdminUsersPageState> => {
  const users = await getAllUsersWithStatus();
  return {
    users,
    formErrors: formErrorStore.getErrors(connectionId),
    inviteResult: inviteUrlStore.consume(adminUserId),
  };
};

// Admin users form resource
const adminUsersForm = createFormResource({
  path: "/admin/users/sse",
  schema: createUserSchema,
  command: createUserCommand,
  eventTypes: ["admin.*", "notification.*"],
  loadState: (user, _c, cid) => loadAdminUsersState(cid, user.id),
  render: renderAdminUsersContent,
});

// Admin users SSE endpoint
adminRouter.post("/users/sse", adminUsersForm.sseHandler);

// Users management page
adminRouter.get("/users", async (c) => {
  const user = c.get("user")!;

  const [state, notifications, unreadCount] = await Promise.all([
    loadAdminUsersState("", user.id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  return c.html(
    AppLayout({
      title: "Manage Users - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Manage Users",
          description: "Add and manage family member accounts",
        })}
        ${adminUsersForm.container(renderAdminUsersContent(state))}
      `,
    }),
  );
});

// Create user handler
adminRouter.post("/users/create", adminUsersForm.postHandler);

// Regenerate invite link for a pending user
adminRouter.post("/users/:id/invite", async (c) => {
  const user = c.get("user")!;
  const userId = c.req.param("id");

  // Find the user to get their name
  const users = await getAllUsersWithStatus();
  const targetUser = users.find((u) => u.id === userId);
  if (!targetUser || targetUser.hasPassword) {
    return c.body(null, 204);
  }

  commandStore.enqueue(regenerateInviteCommand, user, {
    userId,
    userName: targetUser.name || targetUser.email,
  });

  return c.body(null, 204);
});

// Manually trigger the daily reminder job for testing
adminRouter.post("/jobs/run-reminders", async (c) => {
  try {
    await Sidequest.build(DailyReminderJob).queue("reminders").enqueue();
    return c.body(null, 204);
  } catch (error) {
    console.error("Failed to enqueue reminder job:", error);
    return c.body(null, 204);
  }
});
