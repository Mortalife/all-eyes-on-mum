This document guides AI development agents working on this codebase. It covers the tech stack, patterns, how to run/verify changes, and recommended workflows for new features.

You should ensure you don't repeat functionality that already exists in the codebase, you should instead look to extend the existing functionality.

# Coding Guidelines

Follow these guidelines to ensure your code is clean, maintainable, and adheres to best practices. Remember, less code is better. Lines of code = Debt.

# Key Mindsets

**1** **Simplicity**: Write simple and straightforward code.
**2** **Readability**: Ensure your code is easy to read and understand.
**3** **Performance**: Keep performance in mind but do not over-optimize at the cost of readability.
**4** **Maintainability**: Write code that is easy to maintain and update.
**5** **Testability**: Ensure your code is easy to test.
**6** **Reusability**: Write reusable components and functions.
**7** **Security**: Write secure code.

Code Guidelines

**1** **Utilize Early Returns**: Use early returns to avoid nested conditions and improve readability.
**2** **Functional Code**: Use functional and declarative programming patterns; avoid classes.
**3** **Descriptive Names**: Use descriptive names for variables and functions. Prefix event handler functions with "handle" (e.g., handleClick, handleKeyDown).
**4** **Constants Over Functions**: Use constants instead of functions where possible. Define types if applicable.
**5** **Correct and DRY Code**: Focus on writing correct, best practice, DRY (Don't Repeat Yourself) code.
**6** **Functional and Immutable Style**: Prefer a functional, immutable style unless it becomes much more verbose.
**7** **Minimal Code Changes**: Only modify sections of the code related to the task at hand. Avoid modifying unrelated pieces of code. Accomplish goals with minimal code changes.
**8** **Avoid Code Duplication**: Use iteration and modularization over code duplication.
**9** **Avoid Unnecessary Abstractions**: Avoid unnecessary abstractions and over-engineering.
**10** **Separate Concerns**: Separate concerns into distinct modules or files.
**11** **Type over Interface**: Use types over interfaces.

Comments and Documentation

- **Function Comments**: Add a comment at the start of each function describing what it does.

Function Ordering

- Order functions with those that are composing other functions appearing earlier in the file. For example, if you have a menu with multiple buttons, define the menu function above the buttons.

Handling Bugs

- **TODO Comments**: You should not use TODO comments, if you write a TODO then this is you failing to complete the task at hand, you MUST come back and implement/fix it and remove the TODO.

Example Pseudocode Plan and Implementation

When responding to questions, use the Chain of Thought method. Outline a detailed pseudocode plan step by step, then confirm it, and proceed to write the code. Here’s an example:

# Important: Minimal Code Changes

**Only modify sections of the code related to the task at hand.**
**Avoid modifying unrelated pieces of code.**
**Avoid changing existing comments.**
**Avoid any kind of cleanup unless specifically instructed to.**
**Accomplish the goal with the minimum amount of code changes.**
**Code change = potential for bugs and technical debt.**

# Accessibility Rules

Follow these guidelines when implementing UI to ensure accessible software for all users.

## Form Controls

- **Labels with `for` attribute**: Every `<label>` must have a `for` attribute matching the `id` of its associated input
- **Inputs with `id`**: All form inputs (`<input>`, `<select>`, `<textarea>`) must have unique `id` attributes
- **Placeholder is not a label**: Never use `placeholder` as a substitute for `<label>`

```html
<!-- Correct -->
<label for="email">Email address</label>
<input type="email" id="email" name="email" />

<!-- Incorrect -->
<input type="email" placeholder="Email address" />
```

## ARIA Attributes

### Required ARIA Usage

- **`aria-label`**: Use for elements without visible text (icon buttons, etc.)
- **`aria-labelledby`**: Reference visible text that labels an element
- **`aria-describedby`**: Reference text that provides additional description
- **`aria-hidden="true"`**: Hide decorative elements from screen readers
- **`aria-live`**: Announce dynamic content changes (`polite` for non-urgent, `assertive` for urgent)
- **`aria-expanded`**: Indicate expandable element state (accordions, dropdowns)
- **`aria-selected`**: Indicate selection state in lists/tabs
- **`aria-current`**: Indicate current item in navigation (`page`, `step`, `location`)
- **`aria-busy`**: Indicate loading states

```html
<!-- Icon button needs aria-label -->
<button aria-label="Close dialog">
  <svg aria-hidden="true">...</svg>
</button>

<!-- Loading state -->
<div aria-busy="true" aria-live="polite">Loading...</div>

<!-- Navigation -->
<a href="/dashboard" aria-current="page">Dashboard</a>
```

### ARIA Roles

- Use semantic HTML first (`<button>`, `<nav>`, `<main>`, `<article>`, etc.)
- Only add `role` when semantic HTML is not possible
- Common roles: `alert`, `dialog`, `tablist`, `tab`, `tabpanel`, `menu`, `menuitem`

## Semantic HTML

- **Use semantic elements**: `<button>` for actions, `<a>` for navigation, `<nav>`, `<main>`, `<header>`, `<footer>`, `<article>`, `<section>`, `<aside>`
- **Heading hierarchy**: Use `<h1>` through `<h6>` in logical order without skipping levels
- **Lists**: Use `<ul>`, `<ol>`, `<dl>` for list content
- **Tables**: Use `<table>` with `<thead>`, `<tbody>`, `<th scope="col|row">` for tabular data

## Keyboard Navigation

- **All interactive elements must be focusable**: Buttons, links, inputs, custom controls
- **Tab order**: Ensure logical tab order; avoid positive `tabindex` values
- **Focus visible**: Never remove focus outlines without providing an alternative
- **Keyboard handlers**: If using `onClick`, also handle `onKeyDown` for Enter/Space

```html
<!-- Custom interactive element needs tabindex -->
<div
  role="button"
  tabindex="0"
  data-on:keydown="if (event.key === 'Enter' || event.key === ' ') @post('/action')"
>
  Click me
</div>
```

## Images and Media

- **Alt text**: All `<img>` elements must have `alt` attribute
  - Descriptive for informative images
  - Empty `alt=""` for decorative images
- **SVG accessibility**: Use `aria-hidden="true"` for decorative SVGs, or `role="img"` with `aria-label` for meaningful ones

```html
<!-- Informative image -->
<img src="chart.png" alt="Sales increased 25% in Q4 2024" />

<!-- Decorative image -->
<img src="decoration.png" alt="" />

<!-- Decorative SVG -->
<svg aria-hidden="true">...</svg>

<!-- Meaningful SVG -->
<svg role="img" aria-label="Warning icon">...</svg>
```

## Color and Contrast

- **Color contrast**: Minimum 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold)
- **Don't rely on color alone**: Use icons, patterns, or text in addition to color for status/errors
- **Focus indicators**: Ensure visible focus states with sufficient contrast

## Dynamic Content

- **Live regions**: Use `aria-live` for content that updates dynamically
- **Loading states**: Use `aria-busy="true"` and descriptive loading text
- **Error messages**: Associate with inputs using `aria-describedby`

```html
<!-- Error message association -->
<label for="password">Password</label>
<input
  type="password"
  id="password"
  aria-describedby="password-error"
  aria-invalid="true"
/>
<span id="password-error" role="alert"
  >Password must be at least 8 characters</span
>

<!-- Toast notifications -->
<div role="status" aria-live="polite">Changes saved successfully</div>
```

## Modals and Dialogs

- **Focus trap**: Keep focus within modal while open
- **Focus return**: Return focus to trigger element on close
- **Escape to close**: Allow closing with Escape key
- **ARIA attributes**: Use `role="dialog"`, `aria-modal="true"`, `aria-labelledby`

```html
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Action</h2>
  <!-- dialog content -->
</div>
```

## Skip Links

- Provide "Skip to main content" link as first focusable element for keyboard users

```html
<a href="#main-content" class="sr-only focus:not-sr-only"
  >Skip to main content</a
>
<!-- ... navigation ... -->
<main id="main-content">...</main>
```

## Testing Checklist

## Immediate Mode Rendering

This application follows an **immediate mode rendering** pattern where the server owns all UI state. The browser is a thin rendering layer that displays what the server sends.

### Core Principles

1. **Server owns state**: All UI state (search queries, filters, selections) lives on the server, not in browser memory
2. **Commands for everything**: Both reads and writes go through commands that update server state
3. **Render from state**: The render function receives complete state and produces the view
4. **No client-side state drift**: What the server knows is what the user sees

### Benefits

- **Testability**: State is inspectable and commands are pure functions
- **Consistency**: No synchronization issues between client and server
- **Resumability**: User can refresh or return and see the same state
- **Audit trail**: Every state change flows through commands

---

## Page Rendering Pattern

Pages that support both initial load (GET → HTML) and live updates (SSE) use a three-function pattern:

### Pattern Structure

```typescript
// 1. State loader - shared between GET and SSE
const loadPageState = async (
  user: User,
  params: Params,
): Promise<PageState> => {
  const [data, notifications] = await Promise.all([
    fetchData(params),
    getUnreadNotifications(user.id),
  ]);
  return { data, notifications, params };
};

// 2. Content renderer - returns fragment with id for SSE merging
const renderPageContent = (state: PageState) => html`
  <div id="page-content">
    <!-- Content that updates via SSE -->
  </div>
`;

// 3. Full page renderer - wraps content in layout
const renderFullPage = (state: PageState, user: User) => {
  return PageLayout({
    user,
    children: html`
      <div data-init="@get('/page/stream')">${renderPageContent(state)}</div>
    `,
  });
};
```

### Route Definitions

```typescript
// Initial page load - returns full HTML
router.get("/page", async (c) => {
  const user = c.get("user")!;
  const params = parseParams(c);
  const state = await loadPageState(user, params);
  return c.html(renderFullPage(state, user));
});

// SSE updates - returns fragment only
router.get(
  "/page/stream",
  createSSEHandler({
    loadState: (user, c) => loadPageState(user, parseParams(c)),
    render: renderPageContent, // Fragment only, not full page
    eventTypes: ["page.*", "notification.*"],
  }),
);
```

### Key Points

- **SSE returns fragments**: The SSE handler returns only the content div, not the full page with layout
- **Fragment needs id**: The content div must have an `id` attribute for Datastar to merge it
- **Shared state loader**: Both routes use the same `loadPageState` function (DRY)
- **Layout wraps content**: The full page renderer adds `data-init` to establish SSE connection

---

## Server-Side UI State Pattern

For interactive features like modals, search, and filters, store UI state on the server rather than relying on client-side state. This enables proper SSE updates and follows immediate mode rendering principles.

### UI Session Model

Create a dedicated table to store ephemeral UI state keyed by session token:

```typescript
// src/models/ui-session.ts
export type AdminUIState = {
  modalType?: "edit" | "ban" | "delete";
  selectedUserId?: string;
  searchQuery?: string;
};

// Database schema
CREATE TABLE ui_session (
  sessionToken TEXT PRIMARY KEY,
  state TEXT NOT NULL,  -- JSON-serialized AdminUIState
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### State Management Functions

```typescript
// Get current UI state for a session
export const getAdminUIState = async (
  sessionToken: string,
): Promise<AdminUIState | null> => {
  const result = await client.execute({
    sql: "SELECT state FROM ui_session WHERE sessionToken = ?",
    args: [sessionToken],
  });
  if (result.rows.length === 0) return null;
  return JSON.parse(result.rows[0].state as string);
};

// Update UI state
export const updateAdminUIState = async (
  sessionToken: string,
  state: AdminUIState,
) => {
  await client.execute({
    sql: `INSERT INTO ui_session (sessionToken, state, updatedAt)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(sessionToken) DO UPDATE SET
            state = excluded.state,
            updatedAt = excluded.updatedAt`,
    args: [sessionToken, JSON.stringify(state)],
  });
};
```

### Commands for UI State Changes

Define commands that update UI state and emit events:

```typescript
// src/pages/admin/commands.ts
export const selectUserForEdit = defineCommand({
  type: "admin.selectUserForEdit",
  emits: "admin.modalStateChanged",
  handler: async (user, data: { userId: string; sessionToken: string }) => {
    const currentState = await getAdminUIState(data.sessionToken);
    await updateAdminUIState(data.sessionToken, {
      ...currentState,
      modalType: "edit",
      selectedUserId: data.userId,
    });
    return { success: true };
  },
});

export const setUserSearchCommand = defineCommand({
  type: "admin.setUserSearch",
  emits: "admin.searchUpdated",
  handler: async (user, data: { query: string; sessionToken: string }) => {
    const currentState = await getAdminUIState(data.sessionToken);
    await updateAdminUIState(data.sessionToken, {
      ...currentState,
      searchQuery: data.query,
    });
    return { success: true };
  },
});
```

### Action Endpoints Return 204

Endpoints that trigger UI state changes should only enqueue commands and return 204 No Content. Visual updates come via SSE:

```typescript
// Modal selection endpoint - NO HTML returned
adminRouter.post("/users/select/edit/:id", async (c) => {
  const user = c.get("user")!;
  const session = c.get("session");
  const userId = c.req.param("id");

  commandStore.enqueue(selectUserForEdit, user, {
    userId,
    sessionToken: session?.token || "",
  });

  return c.body(null, 204); // No content, SSE will push update
});

// Search endpoint - NO HTML returned
adminRouter.post("/users/search", async (c) => {
  const user = c.get("user")!;
  const session = c.get("session");
  const body = await c.req.json();

  commandStore.enqueue(setUserSearchCommand, user, {
    query: body.query || "",
    sessionToken: session?.token || "",
  });

  return c.body(null, 204); // No content, SSE will push update
});
```

### SSE Endpoint Renders Full Page Content

The SSE endpoint should render enough of the page to include all dynamic elements (modals, search UI, results):

```typescript
adminRouter.get(
  "/users/sse",
  createSSEResource({
    loadState: async (user, c) => {
      const sessionToken = c.get("session")?.token;
      const uiState = sessionToken ? await getAdminUIState(sessionToken) : null;

      // Load data based on UI state
      const query = uiState?.searchQuery || "";
      const users = query ? await searchUsers(query) : await getUsers();

      let selectedUser = null;
      if (uiState?.selectedUserId && uiState?.modalType) {
        selectedUser = await getUserDetail(uiState.selectedUserId);
      }

      return { users, query, uiState, selectedUser };
    },
    render: (state) =>
      UsersPageContent({
        // Renders header, search bar, table, AND modal
        users: state.users,
        query: state.query,
        uiState: state.uiState,
        selectedUser: state.selectedUser,
      }),
    eventTypes: [
      "admin.userUpdated",
      "admin.modalStateChanged",
      "admin.searchUpdated",
    ],
  }),
);
```

### Page Structure for SSE Updates

Place `data-init` high in the DOM so SSE can update large portions of the page:

```typescript
export const AdminUsersPage = ({ user, users, query, uiState }) => {
  return AdminLayout({
    title: "Users - Admin Dashboard",
    user,
    children: html`
      <!-- data-init on container, not nested inside -->
      <div class="max-w-7xl mx-auto" data-init="@get('/admin/users/sse')">
        ${UsersPageContent({ users, query, uiState })}
      </div>
    `,
  });
};

// Content component that SSE re-renders
export const UsersPageContent = ({ users, query, uiState }) => html`
  <div id="users-page-content">
    <!-- Page header with search results text -->
    ${PageHeader({
      title: "Users",
      description: query ? `Search results for "${query}"` : "Manage users",
    })}

    <!-- Search bar with clear button (conditionally rendered) -->
    <div data-signals="${JSON.stringify({ query: query || "" })}">
      <input
        data-bind="query"
        data-on:keydown="if (event.key === 'Enter') @post('/admin/users/search')"
      />
      ${query
        ? html`<button data-on:click="@post('/admin/users/search/clear')">
            Clear
          </button>`
        : ""}
    </div>

    <!-- Users table -->
    ${UsersTable({ users })}

    <!-- Modal container (conditionally rendered) -->
    <div id="admin-user-modal">
      ${uiState?.modalType
        ? ServerUserModal({ user: selectedUser, modalType: uiState.modalType })
        : ""}
    </div>
  </div>
`;
```

### Datastar Patterns for UI State

**Use `data-bind` for inputs:**

```html
<!-- Input bound to signal, no value attribute -->
<input
  type="text"
  id="search-input"
  data-bind="query"
  placeholder="Search..."
  data-on:keydown="if (event.key === 'Enter') @post('/admin/users/search')"
/>
```

**Use `data-on:submit` for forms:**

```html
<!-- Form submission with signal data -->
<form data-on:submit="@post('/admin/users/update')">
  <input data-bind="userName" />
  <button type="submit">Save</button>
</form>
```

**Do NOT pass data in `@post` parameters:**

```html
<!-- ❌ Wrong - passing data in @post -->
<button data-on:click="@post('/admin/users/select/edit', { userId: '123' })">
  Edit
</button>

<!-- ✅ Correct - endpoint gets userId from URL param -->
<button data-on:click="@post('/admin/users/select/edit/123')">Edit</button>
```

### Single Modal Container Pattern

Use one modal container that dynamically renders different modal types based on server state:

```typescript
// Single modal container in page
<div id="admin-user-modal">
  ${uiState?.modalType && selectedUser
    ? ServerUserModal({ user: selectedUser, modalType: uiState.modalType })
    : ""}
</div>

// Modal component switches content based on type
export const ServerUserModal = ({ user, modalType }) => html`
  <dialog class="modal modal-open">
    <div class="modal-box">
      ${modalType === "edit" ? EditUserModalContent({ user }) : ""}
      ${modalType === "ban" ? BanUserModalContent({ user }) : ""}
      ${modalType === "delete" ? DeleteUserModalContent({ user }) : ""}
    </div>
  </dialog>
`;
```

### Action Endpoints Close Modals

After completing an action (update, delete, ban), close the modal by clearing UI state:

```typescript
export const updateUser = defineCommand({
  type: "admin.updateUser",
  emits: "admin.userUpdated",
  handler: async (
    user,
    data: { userId: string; name: string; sessionToken: string },
  ) => {
    // Update user in database
    await updateUserInDb(data.userId, { name: data.name });

    // Close modal by clearing UI state
    const currentState = await getAdminUIState(data.sessionToken);
    await updateAdminUIState(data.sessionToken, {
      ...currentState,
      modalType: undefined,
      selectedUserId: undefined,
    });

    return { success: true };
  },
});
```

### Key Principles

1. **UI state lives in database**: Modal selections, search queries, filters stored in `ui_session` table
2. **Commands update state**: All UI state changes go through commands that emit events
3. **Endpoints return 204**: Action endpoints only enqueue commands, no HTML returned
4. **SSE pushes updates**: Long-lived SSE connection re-renders when events fire
5. **Render from state**: SSE render function reads UI state and produces complete view
6. **High-level SSE target**: Place `data-init` high enough to update headers, search UI, tables, and modals
7. **Single modal container**: One container with dynamic content based on `modalType` state

---

## Notifications (Not Toasts)

Notifications are **first-class entities** stored in the database, not transient UI popups. This enables:

- Persistence across sessions
- User can view notification history
- Mark as read / dismiss actions
- Periodic cleanup of old notifications

### Notification Schema

```sql
CREATE TABLE notification (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'success' | 'error' | 'info' | 'warning'
  title TEXT,
  message TEXT NOT NULL,
  actionUrl TEXT,               -- Optional clickable link
  read INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  expiresAt TEXT,               -- For cleanup job
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);
```

### Notification Commands

```typescript
// User commands for managing their notifications
user.markNotificationRead; // Mark single notification as read
user.markAllNotificationsRead; // Mark all as read
user.dismissNotification; // Delete single notification
user.clearAllNotifications; // Delete all notifications
```

### Creating Notifications

When a command completes, create a notification for the user:

```typescript
handler: async (user, data) => {
  // ... perform action

  await createNotification({
    userId: user.id,
    type: "success",
    title: "Action completed",
    message: "Your changes have been saved.",
  });

  return { success: true };
};
```

### UI Pattern

- **Notification bell** in header showing unread count badge
- **Dropdown** showing recent notifications
- **Full page** at `/app/notifications` for history
- Notifications included in page state and rendered in content

---

### When to Extract Components

- Extract a component when a pattern is used **3+ times**
- Card patterns should use the `Card` component
- Page headers should use the `PageHeader` component
- Always use the `Button` component instead of raw `<button>` elements

### DaisyUI First

- Always check if DaisyUI has a component before creating custom Tailwind
- Use DaisyUI semantic classes (e.g., `text-base-content/60`) over raw colors
- Prefer DaisyUI variants (`btn-primary`, `alert-success`) over custom styling



## Type Location Guidelines

| Type Category            | Location                     |
| ------------------------ | ---------------------------- |
| Shared/domain types      | `src/types/` directory       |
| Component-specific types | Inline in the component file |
| Hono context types       | `src/types/hono.ts`          |
| User type                | `src/types/user.ts`          |
| Subscription types       | `src/types/subscription.ts`  |

Types defined in `src/lib/` files should be re-exported for backwards compatibility but the canonical location is `src/types/`.

---

## Exceptions to Guidelines

### Classes for Background Jobs

Sidequest requires jobs to be classes extending `Job`. This is an exception to the "avoid classes" guideline:

```typescript
// This is acceptable - required by Sidequest
export class EmailJob extends Job {
  async run(data: EmailJobData) {
    // ...
  }
}
```

---

## Tech Stack

### Core Framework

This is a server rendered hypermedia application that provides client side interactivity via Server-Sent Events (SSE). All features are implemented using the CQRS pattern which provides a backend-driven architecture.

- **Hono** (TypeScript) - Lightweight web framework
- **SSR-first** using `hono/html` template literals inside .ts files for templating
- **Datastar** for real-time UI via Server-Sent Events (SSE)

### Key Libraries

- `zod` - Schema validation (v4 - use `z.email()` not `z.string().email()`)
- `sidequest` - Background job processing
- `unstorage` - Universal key-value storage abstraction (configured with `fs-lite` driver in `src/lib/storage.ts`), can be used to store binary and raw data like images, videos, audio files, etc
- `vite` - CSS/JS build tooling
- `tailwindcss` + `daisyui` - Styling and UI components

---