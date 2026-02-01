import { Hono } from "hono";
import { html } from "hono/html";
import { createSSEResource } from "../../lib/cqrs/index.js";
import type { HonoContext } from "../../types/hono.js";
import { Card, PageHeader } from "../../ui/index.js";
import { AppLayout } from "../../ui/layouts/index.js";

export const appRouter = new Hono<HonoContext>();

// Auth guard middleware
appRouter.use("*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.redirect("/");
  }
  await next();
});

// Dashboard state loader
const loadDashboardState = async () => {
  return {
    message: "Welcome to your dashboard!",
    timestamp: new Date().toISOString(),
  };
};

// Dashboard content renderer (used by both GET and SSE)
const renderDashboardContent = (state: { message: string; timestamp: string }) => html`
  <div id="dashboard-content">
    ${Card({
      children: html`
        <div class="card-body">
          <h2 class="card-title">Dashboard</h2>
          <p>${state.message}</p>
          <p class="text-sm text-base-content/60">Last updated: ${state.timestamp}</p>
        </div>
      `,
    })}
  </div>
`;

// Dashboard page
appRouter.get("/", async (c) => {
  const user = c.get("user")!;
  const state = await loadDashboardState();

  return c.html(
    AppLayout({
      title: "Dashboard - All Eyes on Mum",
      user,
      children: html`
        ${PageHeader({ title: "Dashboard", description: "Overview of your account" })}
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
    eventTypes: ["dashboard.*"],
  }),
);
