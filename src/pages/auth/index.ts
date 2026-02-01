import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import {
  createSession,
  createUser,
  deleteSession,
  emailExists,
  isAdminEmail,
  isRegistrationOpen,
  verifyUserCredentials,
} from "../../lib/auth/index.ts";
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from "../../lib/auth/middleware.ts";
import type { HonoContext } from "../../types/hono.ts";
import { Alert, Button, Card, FormField } from "../../ui/index.ts";
import { BaseLayout } from "../../ui/layouts/index.ts";

export const authRouter = new Hono<HonoContext>();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

// Renders the auth layout
const AuthLayout = ({
  title,
  children,
}: {
  title: string;
  children: ReturnType<typeof html>;
}) => {
  return BaseLayout({
    title: `${title} - All Eyes on Mum`,
    children: html`
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="w-full max-w-md">
          ${Card({
            children: html`
              <div class="card-body">
                <h1 class="card-title text-2xl mb-4">${title}</h1>
                ${children}
              </div>
            `,
          })}
        </div>
      </div>
    `,
  });
};

// Login form component
const LoginForm = ({
  email = "",
  error,
  showRegisterLink,
}: {
  email?: string;
  error?: string;
  showRegisterLink: boolean;
}) => html`
  ${error ? Alert({ type: "error", message: error }) : ""}
  <form
    method="POST"
    action="/auth/login"
    class="space-y-4 ${error ? "mt-4" : ""}"
  >
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
          autocomplete="email"
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
          autocomplete="current-password"
        />
      `,
    })}
    <div class="form-control mt-6">
      ${Button({ children: "Login", type: "submit", variant: "primary" })}
    </div>
    ${showRegisterLink
      ? html`
          <p class="text-center text-sm mt-4">
            Don't have an account?
            <a href="/auth/register" class="link link-primary">Register</a>
          </p>
        `
      : ""}
  </form>
`;

// Register form component
const RegisterForm = ({
  name = "",
  email = "",
  error,
}: {
  name?: string;
  email?: string;
  error?: string;
}) => html`
  ${error ? Alert({ type: "error", message: error }) : ""}
  <form
    method="POST"
    action="/auth/register"
    class="space-y-4 ${error ? "mt-4" : ""}"
  >
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
          autocomplete="name"
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
          autocomplete="email"
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
          autocomplete="new-password"
        />
      `,
    })}
    <div class="form-control mt-6">
      ${Button({
        children: "Create Admin Account",
        type: "submit",
        variant: "primary",
      })}
    </div>
    <p class="text-center text-sm mt-4">
      Already have an account?
      <a href="/auth/login" class="link link-primary">Login</a>
    </p>
  </form>
`;

// Login page
authRouter.get("/login", async (c) => {
  const user = c.get("user");
  if (user) {
    return c.redirect("/app");
  }

  const registrationOpen = await isRegistrationOpen();

  return c.html(
    AuthLayout({
      title: "Login",
      children: LoginForm({ showRegisterLink: registrationOpen }),
    }),
  );
});

// Login handler
authRouter.post("/login", async (c) => {
  const formData = await c.req.formData();
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const registrationOpen = await isRegistrationOpen();

  const parsed = loginSchema.safeParse(data);
  if (!parsed.success) {
    return c.html(
      AuthLayout({
        title: "Login",
        children: LoginForm({
          email: data.email,
          error: parsed.error.errors[0].message,
          showRegisterLink: registrationOpen,
        }),
      }),
    );
  }

  const user = await verifyUserCredentials(
    parsed.data.email,
    parsed.data.password,
  );
  if (!user) {
    return c.html(
      AuthLayout({
        title: "Login",
        children: LoginForm({
          email: data.email,
          error: "Invalid email or password",
          showRegisterLink: registrationOpen,
        }),
      }),
    );
  }

  const token = await createSession(user.id);
  setSessionCookie(c, token);

  return c.redirect("/app");
});

// Register page - only available if admin doesn't exist yet
authRouter.get("/register", async (c) => {
  const user = c.get("user");
  if (user) {
    return c.redirect("/app");
  }

  // Check if registration is still open
  const registrationOpen = await isRegistrationOpen();
  if (!registrationOpen) {
    return c.html(
      AuthLayout({
        title: "Registration Closed",
        children: html`
          ${Alert({
            type: "info",
            message:
              "Public registration is closed. Please contact an administrator to create an account.",
          })}
          <div class="mt-4">
            <a href="/auth/login" class="link link-primary">Back to login</a>
          </div>
        `,
      }),
    );
  }

  return c.html(
    AuthLayout({
      title: "Create Admin Account",
      children: html`
        <p class="text-base-content/70 mb-4">
          Set up your admin account to get started. Only the configured admin
          email can register.
        </p>
        ${RegisterForm({})}
      `,
    }),
  );
});

// Register handler
authRouter.post("/register", async (c) => {
  const formData = await c.req.formData();
  const data = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  // Check if registration is still open
  const registrationOpen = await isRegistrationOpen();
  if (!registrationOpen) {
    return c.html(
      AuthLayout({
        title: "Registration Closed",
        children: html`
          ${Alert({
            type: "error",
            message:
              "Registration is closed. The admin account has already been created.",
          })}
          <div class="mt-4">
            <a href="/auth/login" class="link link-primary">Back to login</a>
          </div>
        `,
      }),
    );
  }

  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return c.html(
      AuthLayout({
        title: "Create Admin Account",
        children: RegisterForm({
          name: data.name,
          email: data.email,
          error: parsed.error.errors[0].message,
        }),
      }),
    );
  }

  // Only allow the configured admin email to register
  if (!isAdminEmail(parsed.data.email)) {
    return c.html(
      AuthLayout({
        title: "Create Admin Account",
        children: RegisterForm({
          name: data.name,
          error: "Only the configured admin email can register",
        }),
      }),
    );
  }

  // Check if email already exists
  if (await emailExists(parsed.data.email)) {
    return c.html(
      AuthLayout({
        title: "Create Admin Account",
        children: RegisterForm({
          name: data.name,
          error: "An account with this email already exists",
        }),
      }),
    );
  }

  // Create admin user and session
  const user = await createUser(
    parsed.data.email,
    parsed.data.password,
    parsed.data.name,
    "admin",
  );
  const token = await createSession(user.id);
  setSessionCookie(c, token);

  return c.redirect("/app");
});

// Logout handler
authRouter.get("/logout", async (c) => {
  const token = getSessionToken(c);

  if (token) {
    const parts = token.split(".");
    if (parts[0]) {
      await deleteSession(parts[0]);
    }
  }

  clearSessionCookie(c);
  return c.redirect("/");
});
