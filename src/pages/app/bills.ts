import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import {
  createBillCommand,
  deleteBillCommand,
  markBillPaidCommand,
  updateBillCommand,
} from "../../lib/bills/commands.ts";
import {
  getAllBills,
  getBill,
  getBillPayments,
} from "../../lib/bills/index.ts";
import {
  commandStore,
  createFormResource,
  createSSEResource,
  formErrorStore,
  handleFormPost,
} from "../../lib/cqrs/index.ts";
import type { FormErrors } from "../../lib/cqrs/form-errors.ts";
import {
  getNotifications,
  getUnreadCount,
} from "../../lib/notifications/index.ts";
import type {
  Bill,
  BillCategory,
  BillFrequency,
  BillPayment,
} from "../../types/bill.ts";
import type { HonoContext } from "../../types/hono.ts";
import { Button, Card, FormField, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";

export const billsRouter = new Hono<HonoContext>();

// Bill form validation schema
const billFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === "") return null;
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }),
  frequency: z.enum(["monthly", "quarterly", "annual", "one-off"]),
  dueDate: z.string().min(1, "Due date is required"),
  category: z.enum([
    "utilities",
    "insurance",
    "subscriptions",
    "housing",
    "other",
  ]),
  notes: z
    .string()
    .optional()
    .transform((val) => val || null),
  reminderDays: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === "") return 7;
      const num = parseInt(val, 10);
      return isNaN(num) ? 7 : num;
    }),
});

// Payment form validation schema
const paymentFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .transform((val) => {
      const num = parseFloat(val);
      if (isNaN(num)) throw new Error("Invalid amount");
      return num;
    }),
  notes: z
    .string()
    .optional()
    .transform((val) => val || undefined),
});

// Frequency display labels
const FREQUENCY_LABELS: Record<BillFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  "one-off": "One-off",
};

// Category display labels
const CATEGORY_LABELS: Record<BillCategory, string> = {
  utilities: "Utilities",
  insurance: "Insurance",
  subscriptions: "Subscriptions",
  housing: "Housing",
  other: "Other",
};

// Returns the status of a bill based on due date
const getBillStatus = (dueDate: string): { label: string; class: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return { label: "Overdue", class: "badge-error" };
  }
  if (diffDays <= 7) {
    return { label: "Due Soon", class: "badge-warning" };
  }
  return { label: "Upcoming", class: "badge-success" };
};

// Formats a date for display
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Formats currency for display
const formatCurrency = (amount: number | null): string => {
  if (amount === null) return "Varies";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
};

// Renders a single bill row in the table
const BillRow = (bill: Bill) => {
  const status = getBillStatus(bill.dueDate);

  return html`
    <tr>
      <td>
        <a href="/app/bills/${bill.id}" class="link link-hover font-medium">
          ${bill.name}
        </a>
      </td>
      <td>${formatCurrency(bill.amount)}</td>
      <td>${formatDate(bill.dueDate)}</td>
      <td>
        <span class="badge badge-outline"
          >${CATEGORY_LABELS[bill.category]}</span
        >
      </td>
      <td><span class="badge ${status.class}">${status.label}</span></td>
      <td>
        <a href="/app/bills/${bill.id}" class="btn btn-ghost btn-sm">View</a>
      </td>
    </tr>
  `;
};

// Renders the bills table
const BillsTable = (bills: Bill[]) => {
  if (bills.length === 0) {
    return html`
      <div class="text-center py-12">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-16 w-16 mx-auto text-base-content/30 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="text-lg font-medium text-base-content/70">No bills yet</h3>
        <p class="text-base-content/50 mt-1">
          Add your first bill to start tracking payments.
        </p>
      </div>
    `;
  }

  return html`
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Amount</th>
            <th scope="col">Due Date</th>
            <th scope="col">Category</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          ${bills.map(BillRow)}
        </tbody>
      </table>
    </div>
  `;
};

// Renders the bill form (create/edit)
const BillForm = (props: {
  bill?: Bill;
  action: string;
  submitLabel: string;
  errors: FormErrors | null;
}) => {
  const { bill, action, submitLabel, errors } = props;

  return html`
    ${errors?.formErrors?.length
      ? html`<div class="alert alert-error mb-4">${errors.formErrors[0]}</div>`
      : ""}
    <form
      data-on:submit="@post('${action}')"
      data-signals="${JSON.stringify({
        name: bill?.name || "",
        amount: bill?.amount?.toString() || "",
        frequency: bill?.frequency || "monthly",
        dueDate: bill?.dueDate || "",
        category: bill?.category || "other",
        notes: bill?.notes || "",
        reminderDays: bill?.reminderDays?.toString() || "7",
      })}"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${FormField({
          label: "Bill Name",
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
          label: "Amount",
          htmlFor: "amount",
          error: errors?.fieldErrors?.amount?.[0],
          children: html`
            <input
              type="number"
              id="amount"
              name="amount"
              class="input input-bordered w-full"
              data-bind="amount"
              step="0.01"
              min="0"
              placeholder="Leave empty if varies"
            />
          `,
        })}
        ${FormField({
          label: "Frequency",
          htmlFor: "frequency",
          error: errors?.fieldErrors?.frequency?.[0],
          children: html`
            <select
              id="frequency"
              name="frequency"
              class="select select-bordered w-full"
              data-bind="frequency"
              required
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="one-off">One-off</option>
            </select>
          `,
        })}
        ${FormField({
          label: "Due Date",
          htmlFor: "dueDate",
          error: errors?.fieldErrors?.dueDate?.[0],
          children: html`
            <input
              type="date"
              id="dueDate"
              name="dueDate"
              class="input input-bordered w-full"
              data-bind="dueDate"
              required
            />
          `,
        })}
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
              required
            >
              <option value="utilities">Utilities</option>
              <option value="insurance">Insurance</option>
              <option value="subscriptions">Subscriptions</option>
              <option value="housing">Housing</option>
              <option value="other">Other</option>
            </select>
          `,
        })}
        ${FormField({
          label: "Reminder Days",
          htmlFor: "reminderDays",
          error: errors?.fieldErrors?.reminderDays?.[0],
          children: html`
            <input
              type="number"
              id="reminderDays"
              name="reminderDays"
              class="input input-bordered w-full"
              data-bind="reminderDays"
              min="0"
              max="30"
            />
          `,
        })}

        <div class="md:col-span-2">
          ${FormField({
            label: "Notes",
            htmlFor: "notes",
            error: errors?.fieldErrors?.notes?.[0],
            children: html`
              <textarea
                id="notes"
                name="notes"
                class="textarea textarea-bordered w-full"
                data-bind="notes"
                rows="3"
              ></textarea>
            `,
          })}
        </div>
      </div>

      <div class="mt-6 flex gap-2">
        ${Button({ type: "submit", children: submitLabel })}
        ${Button({ variant: "ghost", href: "/app/bills", children: "Cancel" })}
      </div>
    </form>
  `;
};

// Renders the payment form
const PaymentForm = ({
  bill,
  errors,
}: {
  bill: Bill;
  errors: FormErrors | null;
}) => {
  return html`
    ${errors?.formErrors?.length
      ? html`<div class="alert alert-error mb-4">${errors.formErrors[0]}</div>`
      : ""}
    <form
      data-on:submit="@post('/app/bills/${bill.id}/pay')"
      data-signals="${JSON.stringify({
        paymentAmount: bill.amount?.toString() || "",
        paymentNotes: "",
      })}"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${FormField({
          label: "Amount Paid",
          htmlFor: "paymentAmount",
          error: errors?.fieldErrors?.amount?.[0],
          children: html`
            <input
              type="number"
              id="paymentAmount"
              name="amount"
              class="input input-bordered w-full"
              data-bind="paymentAmount"
              step="0.01"
              min="0"
              required
            />
          `,
        })}
        ${FormField({
          label: "Notes (optional)",
          htmlFor: "paymentNotes",
          error: errors?.fieldErrors?.notes?.[0],
          children: html`
            <input
              type="text"
              id="paymentNotes"
              name="notes"
              class="input input-bordered w-full"
              data-bind="paymentNotes"
              placeholder="e.g., Reference number"
            />
          `,
        })}
      </div>

      <div class="mt-4">
        ${Button({ type: "submit", children: "Mark as Paid" })}
      </div>
    </form>
  `;
};

// Renders the payment history
const PaymentHistory = (payments: BillPayment[]) => {
  if (payments.length === 0) {
    return html`
      <p class="text-base-content/60">No payments recorded yet.</p>
    `;
  }

  return html`
    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Amount</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(
            (payment) => html`
              <tr>
                <td>${formatDate(payment.paidAt)}</td>
                <td>${formatCurrency(payment.amount)}</td>
                <td>${payment.notes || "-"}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
};

// Delete confirmation modal
const DeleteConfirmModal = (bill: Bill) => {
  return html`
    <dialog id="delete-modal" class="modal">
      <div
        class="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <h3 id="delete-modal-title" class="font-bold text-lg">Delete Bill</h3>
        <p class="py-4">
          Are you sure you want to delete <strong>${bill.name}</strong>? This
          will also delete all payment history.
        </p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost">Cancel</button>
          </form>
          <button
            type="button"
            class="btn btn-error"
            data-on:click="@post('/app/bills/${bill.id}/delete')"
          >
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  `;
};

// Page state type
type BillsPageState = {
  bills: Bill[];
};

type BillDetailPageState = {
  bill: Bill;
  payments: BillPayment[];
  formErrors: FormErrors | null;
};

// Bills list content renderer
const renderBillsContent = (state: BillsPageState) => html`
  <div id="bills-content">
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">${BillsTable(state.bills)}</div>
    </div>
  </div>
`;

// Bills list page
billsRouter.get("/", async (c) => {
  const user = c.get("user")!;
  const [bills, notifications, unreadCount] = await Promise.all([
    getAllBills(),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  return c.html(
    AppLayout({
      title: "Bills - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Bills & Renewals",
          description: "Track what's owed and when it's due",
        })}
        <div class="mb-6">
          ${Button({ href: "/app/bills/new", children: "Add Bill" })}
        </div>
        <div data-init="@get('/app/bills/sse')">
          ${renderBillsContent({ bills })}
        </div>
      `,
    }),
  );
});

// Bills SSE endpoint
billsRouter.get(
  "/sse",
  createSSEResource({
    loadState: async (): Promise<BillsPageState> => {
      const bills = await getAllBills();
      return { bills };
    },
    render: renderBillsContent,
    eventTypes: ["bill.*"],
  }),
);

// Form state type for create/edit pages
type BillFormPageState = {
  bill?: Bill;
  action: string;
  submitLabel: string;
  formErrors: FormErrors | null;
};

// Bill form content renderer (used by SSE for create/edit pages)
const renderBillFormContent = (state: BillFormPageState) => html`
  <div id="bill-form-content">
    ${Card({
      children: html`
        <div class="card-body">
          ${BillForm({
            bill: state.bill,
            action: state.action,
            submitLabel: state.submitLabel,
            errors: state.formErrors,
          })}
        </div>
      `,
    })}
  </div>
`;

// Bill form resource (shared by create and edit pages)
const billFormResource = createFormResource({
  path: "/app/bills/form/sse",
  schema: billFormSchema,
  command: createBillCommand,
  eventTypes: ["bill.*"],
  successRedirect: "/app/bills",
  loadState: async (_user, c, cid) => {
    const editId = c.req.query("editId");
    const bill = editId ? await getBill(editId) : undefined;
    return {
      bill: bill || undefined,
      action: editId ? `/app/bills/${editId}` : "/app/bills",
      submitLabel: editId ? "Save Changes" : "Add Bill",
      formErrors: formErrorStore.getErrors(cid),
    };
  },
  render: renderBillFormContent,
});

billsRouter.post("/form/sse", billFormResource.sseHandler);

// New bill page
billsRouter.get("/new", async (c) => {
  const user = c.get("user")!;
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  return c.html(
    AppLayout({
      title: "Add Bill - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Add New Bill",
          description: "Add a recurring bill or renewal to track",
        })}
        ${billFormResource.container(
          renderBillFormContent({
            action: "/app/bills",
            submitLabel: "Add Bill",
            formErrors: null,
          }),
        )}
      `,
    }),
  );
});

// Create bill
billsRouter.post("/", billFormResource.postHandler);

// Bill detail content renderer
const renderBillDetailContent = (state: BillDetailPageState) => {
  const { bill, payments } = state;
  const status = getBillStatus(bill.dueDate);

  return html`
    <div id="bill-detail-content">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <div class="flex items-start justify-between">
                <div>
                  <h2 class="card-title text-2xl">${bill.name}</h2>
                  <p class="text-base-content/60">
                    ${CATEGORY_LABELS[bill.category]} -
                    ${FREQUENCY_LABELS[bill.frequency]}
                  </p>
                </div>
                <span class="badge ${status.class} badge-lg"
                  >${status.label}</span
                >
              </div>

              <div class="divider"></div>

              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-base-content/60">Amount</dt>
                  <dd class="text-xl font-semibold">
                    ${formatCurrency(bill.amount)}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-base-content/60">Due Date</dt>
                  <dd class="text-xl font-semibold">
                    ${formatDate(bill.dueDate)}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-base-content/60">Reminder</dt>
                  <dd>${bill.reminderDays} days before</dd>
                </div>
                <div>
                  <dt class="text-sm text-base-content/60">Payments</dt>
                  <dd>${payments.length} recorded</dd>
                </div>
              </dl>

              ${bill.notes
                ? html`
                    <div class="divider"></div>
                    <div>
                      <h3 class="text-sm text-base-content/60 mb-1">Notes</h3>
                      <p>${bill.notes}</p>
                    </div>
                  `
                : ""}

              <div class="divider"></div>

              <div class="flex gap-2">
                <a href="/app/bills/${bill.id}/edit" class="btn btn-ghost"
                  >Edit</a
                >
                <button
                  type="button"
                  class="btn btn-ghost btn-error"
                  onclick="document.getElementById('delete-modal').showModal()"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h3 class="card-title">Payment History</h3>
              ${PaymentHistory(payments)}
            </div>
          </div>
        </div>

        <div>
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h3 class="card-title">Record Payment</h3>
              <p class="text-sm text-base-content/60 mb-4">
                Mark this bill as paid. The due date will automatically advance
                based on the frequency.
              </p>
              ${PaymentForm({
                bill,
                errors: state.formErrors,
              })}
            </div>
          </div>
        </div>
      </div>

      ${DeleteConfirmModal(bill)}
    </div>
  `;
};

// Bill detail form resource (detail page with payment form)
const billDetailResource = createFormResource({
  path: "",
  schema: paymentFormSchema,
  command: markBillPaidCommand,
  data: (parsed, c) => ({
    billId: c.req.param("id"),
    amount: parsed.amount,
    notes: parsed.notes,
  }),
  eventTypes: ["bill.*", "notification.*"],
  errorRedirect: "/app/bills",
  loadState: async (_user, c, cid) => {
    const id = c.req.param("id");
    const bill = await getBill(id);
    if (!bill) throw new Error("Bill not found");
    const payments = await getBillPayments(id);
    return { bill, payments, formErrors: formErrorStore.getErrors(cid) };
  },
  render: renderBillDetailContent,
});

// Bill detail page
billsRouter.get("/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [bill, notifications, unreadCount] = await Promise.all([
    getBill(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!bill) {
    return c.redirect("/app/bills");
  }

  const payments = await getBillPayments(id);

  return c.html(
    AppLayout({
      title: `${bill.name} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        <div class="mb-6">
          ${Button({
            href: "/app/bills",
            variant: "ghost",
            children: html`
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Bills
            `,
          })}
        </div>
        ${billDetailResource.container(
          renderBillDetailContent({ bill, payments, formErrors: null }),
          `/app/bills/${id}/sse`,
        )}
      `,
    }),
  );
});

// Bill detail SSE endpoint
billsRouter.post("/:id/sse", billDetailResource.sseHandler);

// Edit bill page
billsRouter.get("/:id/edit", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [bill, notifications, unreadCount] = await Promise.all([
    getBill(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!bill) {
    return c.redirect("/app/bills");
  }

  return c.html(
    AppLayout({
      title: `Edit ${bill.name} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: `Edit ${bill.name}`,
          description: "Update bill details",
        })}
        ${billFormResource.container(
          renderBillFormContent({
            bill,
            action: `/app/bills/${id}`,
            submitLabel: "Save Changes",
            formErrors: null,
          }),
          `/app/bills/form/sse?editId=${id}`,
        )}
      `,
    }),
  );
});

// Update bill
billsRouter.post(
  "/:id",
  handleFormPost({
    schema: billFormSchema,
    command: updateBillCommand,
    data: (parsed, c) => ({ id: c.req.param("id"), ...parsed }),
  }),
);

// Mark bill as paid
billsRouter.post("/:id/pay", billDetailResource.postHandler);

// Delete bill
billsRouter.post("/:id/delete", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(deleteBillCommand, user, { id });

  return c.body(null, 204);
});
