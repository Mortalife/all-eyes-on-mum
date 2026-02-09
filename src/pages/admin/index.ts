import { Hono } from "hono";
import { html } from "hono/html";
import { Sidequest } from "sidequest";
import { z } from "zod";
import { DailyReminderJob } from "../../jobs/daily-reminder-job.ts";
import { createUserCommand } from "../../lib/admin/commands.ts";
import { getAllUsers, requireRole } from "../../lib/auth/index.ts";
import { createFormResource, formErrorStore } from "../../lib/cqrs/index.ts";
import type { FormErrors } from "../../lib/cqrs/form-errors.ts";
import {
  getNotifications,
  getUnreadCount,
} from "../../lib/notifications/index.ts";
import type { HonoContext } from "../../types/hono.ts";
import type { User } from "../../types/user.ts";
import { Button, Card, FormField, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";

export const adminRouter = new Hono<HonoContext>();

// Require admin role for all admin routes
adminRouter.use("*", requireRole("admin"));

// Validation schema for creating users
const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

// Renders the users table
const UsersTable = ({ users }: { users: User[] }) => html`
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Created</th>
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
              <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            </tr>
          `,
        )}
      </tbody>
    </table>
  </div>
`;

// Create user form component
const CreateUserForm = ({ errors }: { errors: FormErrors | null }) => html`
  ${errors?.formErrors?.length
    ? html`<div class="alert alert-error mb-4">${errors.formErrors[0]}</div>`
    : ""}
  <form
    data-on:submit="@post('/admin/users/create')"
    data-signals="${JSON.stringify({
      name: "",
      email: "",
      password: "",
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
    ${FormField({
      label: "Password",
      htmlFor: "password",
      error: errors?.fieldErrors?.password?.[0],
      children: html`
        <input
          type="password"
          id="password"
          name="password"
          class="input input-bordered w-full"
          data-bind="password"
          required
          minlength="8"
        />
      `,
    })}
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
  users: User[];
  formErrors: FormErrors | null;
};

// Admin users content renderer (used by both GET and SSE)
const renderAdminUsersContent = (state: AdminUsersPageState) => html`
  <div id="admin-users-content">
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Create user form -->
      <div>
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
      <div>
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
  </div>
`;

// Loads page state
const loadAdminUsersState = async (
  connectionId: string,
): Promise<AdminUsersPageState> => {
  const users = await getAllUsers();
  return {
    users,
    formErrors: formErrorStore.getErrors(connectionId),
  };
};

// Admin users form resource
const adminUsersForm = createFormResource({
  path: "/admin/users/sse",
  schema: createUserSchema,
  command: createUserCommand,
  eventTypes: ["admin.*", "notification.*"],
  loadState: (_user, _c, cid) => loadAdminUsersState(cid),
  render: renderAdminUsersContent,
});

// Admin users SSE endpoint
adminRouter.post("/users/sse", adminUsersForm.sseHandler);

// Users management page
adminRouter.get("/users", async (c) => {
  const user = c.get("user")!;

  const [state, notifications, unreadCount] = await Promise.all([
    loadAdminUsersState(""),
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
