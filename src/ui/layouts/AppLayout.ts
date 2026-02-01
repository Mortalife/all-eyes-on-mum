import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { User } from "../../types/user.js";
import { BaseLayout } from "./BaseLayout.js";

type AppLayoutProps = {
  title: string;
  user: User;
  children: HtmlEscapedString | Promise<HtmlEscapedString>;
};

// App layout with navigation for authenticated users
export const AppLayout = ({ title, user, children }: AppLayoutProps) => {
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
            <div class="flex-none">
              <div class="dropdown dropdown-end">
                <div
                  tabindex="0"
                  role="button"
                  class="btn btn-ghost btn-circle avatar placeholder"
                >
                  <div
                    class="bg-primary text-primary-content w-10 rounded-full"
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
