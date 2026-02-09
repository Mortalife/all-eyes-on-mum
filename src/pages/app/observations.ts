import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import { findUserById } from "../../lib/auth/index.ts";
import {
  commandStore,
  createFormResource,
  formErrorStore,
} from "../../lib/cqrs/index.ts";
import type { FormErrors } from "../../lib/cqrs/form-errors.ts";
import {
  createObservationCommand,
  deleteObservationCommand,
} from "../../lib/observations/commands.ts";
import {
  getAllObservations,
  getObservationsByCategory,
  searchObservations,
} from "../../lib/observations/index.ts";
import {
  getNotifications,
  getUnreadCount,
} from "../../lib/notifications/index.ts";
import type { HonoContext } from "../../types/hono.ts";
import type {
  Observation,
  ObservationCategory,
} from "../../types/observation.ts";
import type { User } from "../../types/user.ts";
import { Button, Card, FormField, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";

export const observationsRouter = new Hono<HonoContext>();

// Observation form validation schema
const observationFormSchema = z.object({
  content: z.string().min(1, "Observation content is required"),
  category: z.enum(["routine", "mood", "physical", "home", "other"]),
  observedAt: z.string().min(1, "Date is required"),
});

// Category badge colors
const CATEGORY_COLORS: Record<ObservationCategory, string> = {
  routine: "badge-info",
  mood: "badge-secondary",
  physical: "badge-error",
  home: "badge-warning",
  other: "badge-ghost",
};

// Category labels
const CATEGORY_LABELS: Record<ObservationCategory, string> = {
  routine: "Routine",
  mood: "Mood",
  physical: "Physical",
  home: "Home",
  other: "Other",
};

// All categories for the filter
const CATEGORIES: ObservationCategory[] = [
  "routine",
  "mood",
  "physical",
  "home",
  "other",
];

// Formats a date as relative time for display
const formatDateDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const observedDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const diffDays = Math.floor(
    (today.getTime() - observedDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-GB", { weekday: "long" });
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// Gets the date key for grouping
const getDateKey = (dateString: string): string => {
  return dateString.split("T")[0];
};

// Formats the date group header
const formatDateGroup = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const groupDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const diffDays = Math.floor(
    (today.getTime() - groupDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

// Type for observation with author info
type ObservationWithAuthor = Observation & {
  authorName: string;
};

// Loads author information for observations
const loadObservationsWithAuthors = async (
  observations: Observation[],
): Promise<ObservationWithAuthor[]> => {
  const userIds = new Set<string>();
  for (const observation of observations) {
    userIds.add(observation.createdBy);
  }

  const users = new Map<string, User>();
  for (const userId of userIds) {
    const user = await findUserById(userId);
    if (user) {
      users.set(userId, user);
    }
  }

  return observations.map((observation) => {
    const author = users.get(observation.createdBy);
    return {
      ...observation,
      authorName: author?.name || author?.email || "Unknown",
    };
  });
};

// Groups observations by date
const groupObservationsByDate = (
  observations: ObservationWithAuthor[],
): Map<string, ObservationWithAuthor[]> => {
  const groups = new Map<string, ObservationWithAuthor[]>();

  for (const observation of observations) {
    const key = getDateKey(observation.observedAt);
    const existing = groups.get(key) || [];
    existing.push(observation);
    groups.set(key, existing);
  }

  return groups;
};

// Gets today's date in YYYY-MM-DD format for the date input default
const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

// Renders the add observation form
const AddObservationForm = ({ errors }: { errors: FormErrors | null }) => html`
  <div class="mb-6">
    ${Card({
      children: html`
        <div class="card-body">
          <h2 class="card-title text-lg mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            Add Observation
          </h2>
          ${errors?.formErrors?.length
            ? html`<div class="alert alert-error mb-4">
                ${errors.formErrors[0]}
              </div>`
            : ""}
          <form
            data-on:submit="@post('/app/observations')"
            data-signals="${JSON.stringify({
              content: "",
              category: "other",
              observedAt: getTodayDate(),
            })}"
          >
            <div class="space-y-4">
              ${FormField({
                label: "What did you notice?",
                htmlFor: "content",
                error: errors?.fieldErrors?.content?.[0],
                children: html`
                  <textarea
                    id="content"
                    name="content"
                    class="textarea textarea-bordered w-full h-24"
                    placeholder="e.g., Mum seemed confused about what day it was..."
                    data-bind="content"
                  ></textarea>
                `,
              })}

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${FormField({
                  label: "Category",
                  htmlFor: "category",
                  error: errors?.fieldErrors?.category?.[0],
                  children: html`
                    <select
                      id="category"
                      name="category"
                      class="select select-bordered w-full"
                      data-bind="category"
                    >
                      <option value="routine">
                        Routine - changes in daily patterns
                      </option>
                      <option value="mood">Mood - emotional state</option>
                      <option value="physical">
                        Physical - health/mobility
                      </option>
                      <option value="home">Home - state of the house</option>
                      <option value="other" selected>Other</option>
                    </select>
                  `,
                })}
                ${FormField({
                  label: "When did you notice this?",
                  htmlFor: "observedAt",
                  error: errors?.fieldErrors?.observedAt?.[0],
                  children: html`
                    <input
                      type="date"
                      id="observedAt"
                      name="observedAt"
                      class="input input-bordered w-full"
                      data-bind="observedAt"
                      max="${getTodayDate()}"
                    />
                  `,
                })}
              </div>

              <div class="flex justify-end">
                ${Button({ type: "submit", children: "Add Observation" })}
              </div>
            </div>
          </form>
        </div>
      `,
    })}
  </div>
`;

// Renders the category badge
const CategoryBadge = (category: ObservationCategory) => html`
  <span class="${`badge ${CATEGORY_COLORS[category]} badge-sm`}">
    ${CATEGORY_LABELS[category]}
  </span>
`;

// Renders a single observation item
const ObservationItem = (observation: ObservationWithAuthor) => html`
  <article
    class="flex gap-4 p-4 bg-base-100 rounded-lg border border-base-200 shadow-sm"
  >
    <div
      class="shrink-0 w-1 rounded-full ${CATEGORY_COLORS[
        observation.category
      ].replace("badge-", "bg-")}"
    ></div>
    <div class="flex-1 min-w-0">
      <p class="text-base-content whitespace-pre-wrap">
        ${observation.content}
      </p>
      <div
        class="flex flex-wrap items-center gap-2 mt-2 text-sm text-base-content/60"
      >
        ${CategoryBadge(observation.category)}
        <span>${observation.authorName}</span>
        <span>${formatDateDisplay(observation.observedAt)}</span>
      </div>
    </div>
    <div class="shrink-0">
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-circle text-error"
        aria-label="Delete observation"
        title="Delete"
        data-on:click="@post('/app/observations/${observation.id}/delete')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  </article>
`;

// Renders empty state
const EmptyState = () => html`
  <div class="text-center py-12 text-base-content/50">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-16 w-16 mx-auto mb-4 opacity-50"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
    <h3 class="text-lg font-medium mb-2">No observations yet</h3>
    <p class="max-w-md mx-auto">
      Record things you notice during visits. Patterns emerge over time that are
      hard to see in isolation.
    </p>
  </div>
`;

// Renders the filter bar
const FilterBar = (
  activeCategory: ObservationCategory | null,
  searchQuery: string,
) => html`
  <div class="flex flex-col sm:flex-row gap-3 mb-6">
    <div class="flex-1">
      <label for="search-observations" class="sr-only"
        >Search observations</label
      >
      <div class="relative">
        <input
          type="search"
          id="search-observations"
          class="input input-bordered w-full pl-10"
          placeholder="Search observations..."
          value="${searchQuery}"
          data-bind="searchQuery"
          data-on:keydown="if (event.key === 'Enter') @post('/app/observations/search')"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </div>
    <div class="flex gap-2 flex-wrap">
      <a
        href="/app/observations"
        class="${`btn btn-sm ${!activeCategory ? "btn-primary" : "btn-ghost"}`}"
      >
        All
      </a>
      ${CATEGORIES.map(
        (cat) => html`
          <a
            href="/app/observations?category=${cat}"
            class="${`btn btn-sm ${activeCategory === cat ? "btn-primary" : "btn-ghost"}`}"
          >
            ${CATEGORY_LABELS[cat]}
          </a>
        `,
      )}
    </div>
  </div>
`;

// Renders the observations timeline
const ObservationsTimeline = (observations: ObservationWithAuthor[]) => {
  if (observations.length === 0) {
    return EmptyState();
  }

  const groups = groupObservationsByDate(observations);
  const sortedKeys = Array.from(groups.keys()).sort().reverse();

  return html`
    <div class="space-y-8">
      ${sortedKeys.map((key) => {
        const groupObservations = groups.get(key)!;
        const dateLabel = formatDateGroup(groupObservations[0].observedAt);
        return html`
          <section>
            <h3
              class="text-sm font-semibold text-base-content/60 mb-3 flex items-center gap-2"
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              ${dateLabel}
            </h3>
            <div class="space-y-3">
              ${groupObservations.map(ObservationItem)}
            </div>
          </section>
        `;
      })}
    </div>
  `;
};

// Page state type
type ObservationsPageState = {
  observations: ObservationWithAuthor[];
  activeCategory: ObservationCategory | null;
  searchQuery: string;
  formErrors: FormErrors | null;
};

// Observations content renderer
const renderObservationsContent = (state: ObservationsPageState) => html`
  <div
    id="observations-content"
    data-signals="${JSON.stringify({ searchQuery: state.searchQuery })}"
  >
    ${AddObservationForm({
      errors: state.formErrors,
    })}
    ${Card({
      children: html`
        <div class="card-body">
          <h2 class="card-title text-lg mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Timeline
            ${state.activeCategory
              ? html` <span class="badge badge-ghost ml-2"
                  >${CATEGORY_LABELS[state.activeCategory]}</span
                >`
              : ""}
            ${state.searchQuery
              ? html` <span class="badge badge-ghost ml-2"
                  >Search: "${state.searchQuery}"</span
                >`
              : ""}
          </h2>

          ${FilterBar(state.activeCategory, state.searchQuery)}
          ${ObservationsTimeline(state.observations)}
        </div>
      `,
    })}
  </div>
`;

// Loads page state
const loadObservationsPageState = async (
  category: ObservationCategory | null,
  query: string,
  connectionId: string,
): Promise<ObservationsPageState> => {
  let observations: Observation[];

  if (query) {
    observations = await searchObservations(query);
  } else if (category) {
    observations = await getObservationsByCategory(category);
  } else {
    observations = await getAllObservations();
  }

  const observationsWithAuthors =
    await loadObservationsWithAuthors(observations);

  return {
    observations: observationsWithAuthors,
    activeCategory: category,
    searchQuery: query,
    formErrors: formErrorStore.getErrors(connectionId),
  };
};

// Parses query params
const parseQueryParams = (c: {
  req: { query: (key: string) => string | undefined };
}) => {
  const category = c.req.query("category") as ObservationCategory | undefined;
  const search = c.req.query("search") || "";
  return {
    category: category && CATEGORIES.includes(category) ? category : null,
    search,
  };
};

// Form resource for observation creation + SSE
const observationsForm = createFormResource({
  path: "/app/observations/sse",
  schema: observationFormSchema,
  command: createObservationCommand,
  eventTypes: ["observation.*", "notification.*"],
  loadState: (_user, c, cid) => {
    const { category, search } = parseQueryParams(c);
    return loadObservationsPageState(category, search, cid);
  },
  render: renderObservationsContent,
});

// Observations list page
observationsRouter.get("/", async (c) => {
  const user = c.get("user")!;
  const { category, search } = parseQueryParams(c);

  const [state, notifications, unreadCount] = await Promise.all([
    loadObservationsPageState(category, search, ""),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  // Build SSE URL query params
  const sseParams = new URLSearchParams();
  if (category) sseParams.set("category", category);
  if (search) sseParams.set("search", search);

  return c.html(
    AppLayout({
      title: "Observations - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Observations",
          description:
            "Record things you notice during visits - patterns emerge over time",
        })}
        ${observationsForm.container(
          renderObservationsContent(state),
          `/app/observations/sse?${sseParams.toString()}`,
        )}
      `,
    }),
  );
});

// Observations SSE endpoint
observationsRouter.post("/sse", observationsForm.sseHandler);

// Create observation
observationsRouter.post("/", observationsForm.postHandler);

// Search observations (updates URL with search query)
observationsRouter.post("/search", async (c) => {
  const body = await c.req.json();
  const query = body.searchQuery || "";

  if (query) {
    return c.redirect(`/app/observations?search=${encodeURIComponent(query)}`);
  }
  return c.redirect("/app/observations");
});

// Delete observation
observationsRouter.post("/:id/delete", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(deleteObservationCommand, user, { id });

  return c.body(null, 204);
});
