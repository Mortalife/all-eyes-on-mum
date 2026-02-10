import { Hono } from "hono";
import { html } from "hono/html";
import type { HonoContext } from "../../types/hono.ts";
import { Button } from "../../ui/index.ts";
import { BaseLayout } from "../../ui/layouts/index.ts";

export const marketingRouter = new Hono<HonoContext>();

// SVG icon for the heart/family logo
const LogoIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    class="h-10 w-10 text-primary"
    aria-hidden="true"
  >
    <path
      d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"
    />
  </svg>
`;

// Feature card icon components
const CalendarIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="h-8 w-8"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
    />
  </svg>
`;

const ClipboardIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="h-8 w-8"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75"
    />
  </svg>
`;

const BellIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="h-8 w-8"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
    />
  </svg>
`;

const HeartPulseIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="h-8 w-8"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
    />
  </svg>
`;

const EyeIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="h-8 w-8"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
    />
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
`;

const DocumentIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="h-8 w-8"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
    />
  </svg>
`;

// Feature card data
type FeatureCard = {
  icon: ReturnType<typeof html>;
  title: string;
  description: string;
  color: string;
};

const features: FeatureCard[] = [
  {
    icon: CalendarIcon(),
    title: "Appointments",
    description: "Keep track of all upcoming appointments in one place",
    color: "text-primary",
  },
  {
    icon: BellIcon(),
    title: "Reminders",
    description: "Never miss important tasks with gentle daily reminders",
    color: "text-secondary",
  },
  {
    icon: HeartPulseIcon(),
    title: "Health Notes",
    description: "Record health observations and medication details",
    color: "text-error",
  },
  {
    icon: EyeIcon(),
    title: "Observations",
    description: "Log daily observations so the whole family stays informed",
    color: "text-info",
  },
  {
    icon: DocumentIcon(),
    title: "Contracts & Bills",
    description: "Manage household contracts, bills, and monthly expenses",
    color: "text-warning",
  },
  {
    icon: ClipboardIcon(),
    title: "Shared Notes",
    description: "Leave notes for family members to read and stay aligned",
    color: "text-success",
  },
];

// Renders a single feature card
const FeatureCardComponent = ({
  icon,
  title,
  description,
  color,
}: FeatureCard) => html`
  <div
    class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow duration-300"
  >
    <div class="card-body items-center text-center gap-3">
      <div class="${color}">${icon}</div>
      <h3 class="card-title text-base">${title}</h3>
      <p class="text-sm text-base-content/60">${description}</p>
    </div>
  </div>
`;

// Home page
marketingRouter.get("/", (c) => {
  const user = c.get("user");
  if (user) {
    return c.redirect("/app");
  }

  return c.html(
    BaseLayout({
      title: "All Eyes on Mum",
      children: html`
        <style>
          @keyframes float {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          @keyframes fade-in-up {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes pulse-soft {
            0%,
            100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
          .animate-fade-in-up {
            animation: fade-in-up 0.6s ease-out both;
          }
          .animate-fade-in-up-delay-1 {
            animation: fade-in-up 0.6s ease-out 0.15s both;
          }
          .animate-fade-in-up-delay-2 {
            animation: fade-in-up 0.6s ease-out 0.3s both;
          }
          .animate-fade-in-up-delay-3 {
            animation: fade-in-up 0.6s ease-out 0.45s both;
          }
          .animate-pulse-soft {
            animation: pulse-soft 2s ease-in-out infinite;
          }
        </style>

        <div class="min-h-screen flex flex-col">
          <!-- Hero Section -->
          <section
            class="flex-1 flex items-center justify-center relative overflow-hidden"
          >
            <!-- Decorative background shapes -->
            <div
              class="absolute inset-0 overflow-hidden pointer-events-none"
              aria-hidden="true"
            >
              <div
                class="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
              ></div>
              <div
                class="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] bg-secondary/5 rounded-full blur-3xl"
              ></div>
              <div
                class="absolute top-1/4 left-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl"
              ></div>
            </div>

            <div class="relative z-10 text-center px-6 py-16 max-w-2xl mx-auto">
              <!-- Floating logo -->
              <div
                class="animate-float mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10"
              >
                ${LogoIcon()}
              </div>

              <!-- Title -->
              <h1
                class="animate-fade-in-up text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-base-content"
              >
                All Eyes on
                <span class="text-primary">Mum</span>
              </h1>

              <!-- Subtitle -->
              <p
                class="animate-fade-in-up-delay-1 mt-4 text-lg sm:text-xl text-base-content/60 max-w-md mx-auto"
              >
                Helping the family stay connected and coordinated, so Mum always
                has the support she needs.
              </p>

              <!-- CTA Buttons -->
              <div
                class="animate-fade-in-up-delay-2 mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center"
              >
                ${Button({
                  children: "Sign In",
                  href: "/auth/login",
                  variant: "primary",
                  size: "lg",
                })}
              </div>

              <!-- Trust line -->
              <p
                class="animate-fade-in-up-delay-3 mt-6 text-sm text-base-content/40"
              >
                A private space just for family
              </p>
            </div>
          </section>

          <!-- Features Section -->
          <section id="features" class="py-16 px-6 bg-base-100">
            <div class="max-w-4xl mx-auto">
              <div class="text-center mb-12">
                <h2 class="text-2xl sm:text-3xl font-bold text-base-content">
                  Everything in one place
                </h2>
                <p class="mt-3 text-base-content/60 max-w-lg mx-auto">
                  Keep the whole family on the same page with shared tools
                  designed for care coordination.
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                ${features.map(FeatureCardComponent)}
              </div>
            </div>
          </section>

          <!-- Footer -->
          <footer class="py-8 px-6 text-center">
            <p class="text-sm text-base-content/40">
              Made with care for the ones who matter most.
            </p>
          </footer>
        </div>
      `,
    }),
  );
});
