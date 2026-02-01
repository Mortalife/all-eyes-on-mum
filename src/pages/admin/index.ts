import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import { createUser, emailExists, getAllUsers, requireRole } from "../../lib/auth/index.js";
import type { HonoContext } from "../../types/hono.js";
import type { User } from "../../types/user.js";
import { Alert, Button, Card, FormField, PageHeader } from "../../ui/index.js";
import { AppLayout } from "../../ui/layouts/index.js";

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
                <span class="badge ${user.role === "admin" ? "badge-primary" : "badge-ghost"}">
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
const CreateUserForm = ({
  name = "",
  email = "",
  error,
  success,
}: {
  name?: string;
  email?: string;
  error?: string;
  success?: string;
}) => html`
  ${error ? Alert({ type: "error", message: error }) : ""}
  ${success ? Alert({ type: "success", message: success }) : ""}
  <form method="POST" action="/admin/users/create" class="space-y-4 ${error || success ? "mt-4" : ""}">
    ${FormField({
      label: "Name",
      htmlFor: "name",
      children: html`
        <input
          type="text"
          id="name"
          name="name"
          value="${name}"
          class="input input-bordered w-full"
          required
        />
      `,
    })}
    ${FormField({
      label: "Email",
      htmlFor: "email",
      children: html`
        <input
          type="email"
          id="email"
          name="email"
          value="${email}"
          class="input input-bordered w-full"
          required
        />
      `,
    })}
    ${FormField({
      label: "Password",
      htmlFor: "password",
      children: html`
        <input
          type="password"
          id="password"
          name="password"
          class="input input-bordered w-full"
          required
          minlength="8"
        />
      `,
    })}
    <div class="form-control mt-4">
      ${Button({ children: "Create User", type: "submit", variant: "primary" })}
    </div>
  </form>
`;

// Users management page
adminRouter.get("/users", async (c) => {
  const user = c.get("user")!;
  const users = await getAllUsers();
  const success = c.req.query("success");

  return c.html(
    AppLayout({
      title: "Manage Users - All Eyes on Mum",
      user,
      children: html`
        ${PageHeader({
          title: "Manage Users",
          description: "Add and manage family member accounts",
        })}

        <div class="grid gap-6 lg:grid-cols-2">
          <!-- Create user form -->
          <div>
            ${Card({
              children: html`
                <div class="card-body">
                  <h2 class="card-title">Add Family Member</h2>
                  ${CreateUserForm({ success: success === "1" ? "User created successfully" : undefined })}
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
                  ${users.length > 0
                    ? UsersTable({ users })
                    : html`<p class="text-base-content/60">No users yet</p>`}
                </div>
              `,
            })}
          </div>
        </div>
      `,
    }),
  );
});

// Create user handler
adminRouter.post("/users/create", async (c) => {
  const user = c.get("user")!;
  const formData = await c.req.formData();
  const data = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    const users = await getAllUsers();
    return c.html(
      AppLayout({
        title: "Manage Users - All Eyes on Mum",
        user,
        children: html`
          ${PageHeader({
            title: "Manage Users",
            description: "Add and manage family member accounts",
          })}

          <div class="grid gap-6 lg:grid-cols-2">
            <div>
              ${Card({
                children: html`
                  <div class="card-body">
                    <h2 class="card-title">Add Family Member</h2>
                    ${CreateUserForm({
                      name: data.name,
                      email: data.email,
                      error: parsed.error.errors[0].message,
                    })}
                  </div>
                `,
              })}
            </div>
            <div>
              ${Card({
                children: html`
                  <div class="card-body">
                    <h2 class="card-title">Family Members</h2>
                    ${users.length > 0
                      ? UsersTable({ users })
                      : html`<p class="text-base-content/60">No users yet</p>`}
                  </div>
                `,
              })}
            </div>
          </div>
        `,
      }),
    );
  }

  // Check if email already exists
  if (await emailExists(parsed.data.email)) {
    const users = await getAllUsers();
    return c.html(
      AppLayout({
        title: "Manage Users - All Eyes on Mum",
        user,
        children: html`
          ${PageHeader({
            title: "Manage Users",
            description: "Add and manage family member accounts",
          })}

          <div class="grid gap-6 lg:grid-cols-2">
            <div>
              ${Card({
                children: html`
                  <div class="card-body">
                    <h2 class="card-title">Add Family Member</h2>
                    ${CreateUserForm({
                      name: data.name,
                      error: "An account with this email already exists",
                    })}
                  </div>
                `,
              })}
            </div>
            <div>
              ${Card({
                children: html`
                  <div class="card-body">
                    <h2 class="card-title">Family Members</h2>
                    ${users.length > 0
                      ? UsersTable({ users })
                      : html`<p class="text-base-content/60">No users yet</p>`}
                  </div>
                `,
              })}
            </div>
          </div>
        `,
      }),
    );
  }

  // Create the user
  await createUser(parsed.data.email, parsed.data.password, parsed.data.name);

  return c.redirect("/admin/users?success=1");
});
