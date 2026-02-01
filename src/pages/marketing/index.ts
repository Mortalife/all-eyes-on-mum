import { Hono } from "hono";
import { html } from "hono/html";
import type { HonoContext } from "../../types/hono.js";
import { Button } from "../../ui/index.js";
import { BaseLayout } from "../../ui/layouts/index.js";

export const marketingRouter = new Hono<HonoContext>();

// Home page
marketingRouter.get("/", (c) => {
  return c.html(
    BaseLayout({
      title: "All Eyes on Mum",
      children: html`
        <div class="hero min-h-screen">
          <div class="hero-content text-center">
            <div class="max-w-md">
              <h1 class="text-5xl font-bold">All Eyes on Mum</h1>
              <p class="py-6">Welcome to your new application.</p>
              <div class="flex gap-4 justify-center">
                ${Button({ children: "Get Started", href: "/app", variant: "primary" })}
                ${Button({ children: "Learn More", href: "#features", variant: "ghost" })}
              </div>
            </div>
          </div>
        </div>
      `,
    }),
  );
});
