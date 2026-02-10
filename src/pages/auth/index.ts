import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import {
  createSession,
  createUser,
  deleteSession,
  deleteUserSessions,
  emailExists,
  isAdminEmail,
  isRegistrationOpen,
  setUserPassword,
  verifyUserCredentials,
} from "../../lib/auth/index.ts";
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from "../../lib/auth/middleware.ts";
import { rateLimit } from "../../lib/auth/rate-limit.ts";
import {
  consumeRegistrationToken,
  validateRegistrationToken,
} from "../../lib/auth/registration-token.ts";
import type { HonoContext } from "../../types/hono.ts";
import { Alert, Button, Card, FormField } from "../../ui/index.ts";
import { BaseLayout } from "../../ui/layouts/index.ts";

export const authRouter = new Hono<HonoContext>();

const loginRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10 });
const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
});
const inviteRegisterRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
});

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

const inviteRegisterSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
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
authRouter.post("/login", loginRateLimit, async (c) => {
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
authRouter.post("/register", registerRateLimit, async (c) => {
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

// Invite registration form component - for users setting their password via invite link
const InviteRegisterForm = ({
  name,
  token,
  error,
  fieldErrors,
}: {
  name: string;
  token: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}) => html`
  ${error ? Alert({ type: "error", message: error }) : ""}
  <p class="text-base-content/70 mb-4">
    Welcome, ${name}! Set your password to complete your account setup.
  </p>
  <form
    method="POST"
    action="/auth/register/${token}"
    class="space-y-4 ${error ? "mt-4" : ""}"
  >
    ${FormField({
      label: "Password",
      htmlFor: "password",
      error: fieldErrors?.password?.[0],
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
    ${FormField({
      label: "Confirm Password",
      htmlFor: "confirmPassword",
      error: fieldErrors?.confirmPassword?.[0],
      children: html`
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          class="input input-bordered w-full"
          required
          minlength="8"
          autocomplete="new-password"
        />
      `,
    })}
    <div class="form-control mt-6">
      ${Button({
        children: "Set Password",
        type: "submit",
        variant: "primary",
      })}
    </div>
  </form>
`;

// Referrer-Policy for token routes to prevent token leakage
authRouter.use("/register/:token", async (c, next) => {
  await next();
  c.header("Referrer-Policy", "strict-origin");
});

// Invite registration page - validates token and shows password form
authRouter.get("/register/:token", async (c) => {
  const user = c.get("user");
  if (user) {
    return c.redirect("/app");
  }

  const token = c.req.param("token");
  const invitedUser = await validateRegistrationToken(token);

  if (!invitedUser) {
    return c.html(
      AuthLayout({
        title: "Invalid Invite Link",
        children: html`
          ${Alert({
            type: "error",
            message:
              "This invite link is invalid or has expired. Please contact an administrator for a new link.",
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
      title: "Complete Registration",
      children: InviteRegisterForm({
        name: invitedUser.name || invitedUser.email,
        token,
      }),
    }),
  );
});

// Invite registration handler - sets password and creates session
authRouter.post("/register/:token", inviteRegisterRateLimit, async (c) => {
  const token = c.req.param("token");
  const formData = await c.req.formData();
  const data = {
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = inviteRegisterSchema.safeParse(data);
  if (!parsed.success) {
    // Need to validate token again to get user name for re-rendering
    const invitedUser = await validateRegistrationToken(token);
    if (!invitedUser) {
      return c.html(
        AuthLayout({
          title: "Invalid Invite Link",
          children: html`
            ${Alert({
              type: "error",
              message:
                "This invite link is invalid or has expired. Please contact an administrator for a new link.",
            })}
            <div class="mt-4">
              <a href="/auth/login" class="link link-primary">Back to login</a>
            </div>
          `,
        }),
      );
    }

    const flatErrors = parsed.error.flatten();
    return c.html(
      AuthLayout({
        title: "Complete Registration",
        children: InviteRegisterForm({
          name: invitedUser.name || invitedUser.email,
          token,
          error: flatErrors.formErrors[0],
          fieldErrors: flatErrors.fieldErrors,
        }),
      }),
    );
  }

  // Consume token (single-use) and get user
  const invitedUser = await consumeRegistrationToken(token);
  if (!invitedUser) {
    return c.html(
      AuthLayout({
        title: "Invalid Invite Link",
        children: html`
          ${Alert({
            type: "error",
            message:
              "This invite link is invalid or has expired. Please contact an administrator for a new link.",
          })}
          <div class="mt-4">
            <a href="/auth/login" class="link link-primary">Back to login</a>
          </div>
        `,
      }),
    );
  }

  // Set the user's password
  await setUserPassword(invitedUser.id, parsed.data.password);

  // Invalidate any existing sessions (Copenhagen Book recommendation)
  await deleteUserSessions(invitedUser.id);

  // Create a new session and log the user in
  const sessionToken = await createSession(invitedUser.id);
  setSessionCookie(c, sessionToken);

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
