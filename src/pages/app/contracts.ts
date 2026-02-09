import { Hono } from "hono";
import { html } from "hono/html";
import { z } from "zod";
import {
  createContractCommand,
  deleteContractCommand,
  updateContractCommand,
} from "../../lib/contracts/commands.ts";
import {
  getAllContracts,
  getContract,
  getTotalMonthlyExpenditure,
} from "../../lib/contracts/index.ts";
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
  Contract,
  ContractCategory,
  PaymentMethod,
} from "../../types/contract.ts";
import type { HonoContext } from "../../types/hono.ts";
import { Button, Card, FormField, PageHeader } from "../../ui/index.ts";
import { AppLayout } from "../../ui/layouts/index.ts";

export const contractsRouter = new Hono<HonoContext>();

// Contract form validation schema
const contractFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  provider: z
    .string()
    .optional()
    .transform((val) => val || null),
  monthlyAmount: z
    .string()
    .min(1, "Monthly amount is required")
    .transform((val) => {
      const num = parseFloat(val);
      if (isNaN(num)) throw new Error("Invalid amount");
      return num;
    }),
  paymentMethod: z.enum(["direct_debit", "standing_order", "manual"]),
  contractStartDate: z
    .string()
    .optional()
    .transform((val) => val || null),
  contractEndDate: z
    .string()
    .optional()
    .transform((val) => val || null),
  category: z.enum([
    "utilities",
    "insurance",
    "subscriptions",
    "housing",
    "other",
  ]),
  isUsageBased: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  notes: z
    .string()
    .optional()
    .transform((val) => val || null),
});

// Category display labels
const CATEGORY_LABELS: Record<ContractCategory, string> = {
  utilities: "Utilities",
  insurance: "Insurance",
  subscriptions: "Subscriptions",
  housing: "Housing",
  other: "Other",
};

// Payment method display labels
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  direct_debit: "Direct Debit",
  standing_order: "Standing Order",
  manual: "Manual",
};

// Returns the status of a contract based on end date
const getContractStatus = (
  endDate: string | null,
): { label: string; class: string } => {
  if (!endDate) {
    return { label: "Ongoing", class: "badge-success" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) {
    return { label: "Expired", class: "badge-error" };
  }
  if (diffDays <= 30) {
    return { label: "Expiring Soon", class: "badge-warning" };
  }
  return { label: "Active", class: "badge-success" };
};

// Formats a date for display
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// Formats currency for display
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
};

// Renders a single contract row in the table
const ContractRow = (contract: Contract) => {
  const status = getContractStatus(contract.contractEndDate);

  return html`
    <tr>
      <td>
        <a
          href="/app/contracts/${contract.id}"
          class="link link-hover font-medium"
        >
          ${contract.name}
        </a>
        ${contract.provider
          ? html`<span class="text-sm text-base-content/60 block"
              >${contract.provider}</span
            >`
          : ""}
      </td>
      <td>${formatCurrency(contract.monthlyAmount)}</td>
      <td>
        <span class="badge badge-outline"
          >${CATEGORY_LABELS[contract.category]}</span
        >
      </td>
      <td>${formatDate(contract.contractEndDate)}</td>
      <td>
        <span class="badge ${status.class}">${status.label}</span>
        ${contract.isUsageBased
          ? html`<span
              class="badge badge-ghost badge-sm ml-1"
              title="Usage-based pricing"
              >Usage</span
            >`
          : ""}
      </td>
      <td>
        <a href="/app/contracts/${contract.id}" class="btn btn-ghost btn-sm"
          >View</a
        >
      </td>
    </tr>
  `;
};

// Renders the contracts table
const ContractsTable = (contracts: Contract[]) => {
  if (contracts.length === 0) {
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
        <h3 class="text-lg font-medium text-base-content/70">
          No contracts yet
        </h3>
        <p class="text-base-content/50 mt-1">
          Add your first contract to start tracking monthly expenditure.
        </p>
      </div>
    `;
  }

  return html`
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">Contract</th>
            <th scope="col">Monthly</th>
            <th scope="col">Category</th>
            <th scope="col">End Date</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          ${contracts.map(ContractRow)}
        </tbody>
      </table>
    </div>
  `;
};

// Renders the contract form (create/edit)
const ContractForm = (props: {
  contract?: Contract;
  action: string;
  submitLabel: string;
  errors: FormErrors | null;
}) => {
  const { contract, action, submitLabel, errors } = props;

  return html`
    ${errors?.formErrors?.length
      ? html`<div class="alert alert-error mb-4">${errors.formErrors[0]}</div>`
      : ""}
    <form
      data-on:submit="@post('${action}')"
      data-signals="${JSON.stringify({
        name: contract?.name || "",
        provider: contract?.provider || "",
        monthlyAmount: contract?.monthlyAmount?.toString() || "",
        paymentMethod: contract?.paymentMethod || "direct_debit",
        contractStartDate: contract?.contractStartDate || "",
        contractEndDate: contract?.contractEndDate || "",
        category: contract?.category || "other",
        isUsageBased: contract?.isUsageBased ? "true" : "false",
        notes: contract?.notes || "",
      })}"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${FormField({
          label: "Contract Name",
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
              placeholder="e.g., Council Tax, Car Insurance"
            />
          `,
        })}
        ${FormField({
          label: "Provider",
          htmlFor: "provider",
          error: errors?.fieldErrors?.provider?.[0],
          children: html`
            <input
              type="text"
              id="provider"
              name="provider"
              class="input input-bordered w-full"
              data-bind="provider"
              placeholder="e.g., British Gas, Admiral"
            />
          `,
        })}
        ${FormField({
          label: "Monthly Amount",
          htmlFor: "monthlyAmount",
          error: errors?.fieldErrors?.monthlyAmount?.[0],
          children: html`
            <input
              type="number"
              id="monthlyAmount"
              name="monthlyAmount"
              class="input input-bordered w-full"
              data-bind="monthlyAmount"
              step="0.01"
              min="0"
              required
            />
          `,
        })}
        ${FormField({
          label: "Payment Method",
          htmlFor: "paymentMethod",
          error: errors?.fieldErrors?.paymentMethod?.[0],
          children: html`
            <select
              id="paymentMethod"
              name="paymentMethod"
              class="select select-bordered w-full"
              data-bind="paymentMethod"
              required
            >
              <option value="direct_debit">Direct Debit</option>
              <option value="standing_order">Standing Order</option>
              <option value="manual">Manual Payment</option>
            </select>
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
          label: "Contract Start Date",
          htmlFor: "contractStartDate",
          error: errors?.fieldErrors?.contractStartDate?.[0],
          children: html`
            <input
              type="date"
              id="contractStartDate"
              name="contractStartDate"
              class="input input-bordered w-full"
              data-bind="contractStartDate"
            />
          `,
        })}
        ${FormField({
          label: "Contract End Date",
          htmlFor: "contractEndDate",
          error: errors?.fieldErrors?.contractEndDate?.[0],
          children: html`
            <input
              type="date"
              id="contractEndDate"
              name="contractEndDate"
              class="input input-bordered w-full"
              data-bind="contractEndDate"
            />
            <label class="label">
              <span class="label-text-alt"
                >Leave empty for ongoing contracts</span
              >
            </label>
          `,
        })}
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-3">
            <input
              type="checkbox"
              id="isUsageBased"
              name="isUsageBased"
              class="checkbox"
              data-bind="isUsageBased"
              data-attr-checked="$isUsageBased === 'true'"
            />
            <span class="label-text">
              <strong>Usage-based pricing</strong>
              <span class="block text-sm text-base-content/60">
                Monthly amount varies based on actual usage (e.g., utilities)
              </span>
            </span>
          </label>
        </div>

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
                placeholder="Account numbers, contact details, etc."
              ></textarea>
            `,
          })}
        </div>
      </div>

      <div class="mt-6 flex gap-2">
        ${Button({ type: "submit", children: submitLabel })}
        ${Button({
          variant: "ghost",
          href: "/app/contracts",
          children: "Cancel",
        })}
      </div>
    </form>
  `;
};

// Delete confirmation modal
const DeleteConfirmModal = (contract: Contract) => {
  return html`
    <dialog id="delete-modal" class="modal">
      <div
        class="modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <h3 id="delete-modal-title" class="font-bold text-lg">
          Delete Contract
        </h3>
        <p class="py-4">
          Are you sure you want to delete <strong>${contract.name}</strong>?
        </p>
        <div class="modal-action">
          <form method="dialog">
            <button class="btn btn-ghost">Cancel</button>
          </form>
          <button
            type="button"
            class="btn btn-error"
            data-on:click="@post('/app/contracts/${contract.id}/delete')"
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
type ContractsPageState = {
  contracts: Contract[];
  totalMonthly: number;
};

type ContractDetailPageState = {
  contract: Contract;
};

// Contracts list content renderer
const renderContractsContent = (state: ContractsPageState) => html`
  <div id="contracts-content">
    <div class="stats shadow mb-6">
      <div class="stat">
        <div class="stat-title">Total Monthly Expenditure</div>
        <div class="stat-value text-primary">
          ${formatCurrency(state.totalMonthly)}
        </div>
        <div class="stat-desc">${state.contracts.length} active contracts</div>
      </div>
    </div>
    <div class="card bg-base-100 shadow-xl">
      <div class="card-body">${ContractsTable(state.contracts)}</div>
    </div>
  </div>
`;

// Contracts list page
contractsRouter.get("/", async (c) => {
  const user = c.get("user")!;
  const [contracts, totalMonthly, notifications, unreadCount] =
    await Promise.all([
      getAllContracts(),
      getTotalMonthlyExpenditure(),
      getNotifications(user.id, 5),
      getUnreadCount(user.id),
    ]);

  return c.html(
    AppLayout({
      title: "Contracts - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Contracts",
          description: "Track monthly expenditure and contract renewals",
        })}
        <div class="mb-6">
          ${Button({ href: "/app/contracts/new", children: "Add Contract" })}
        </div>
        <div data-init="@get('/app/contracts/sse')">
          ${renderContractsContent({ contracts, totalMonthly })}
        </div>
      `,
    }),
  );
});

// Contracts SSE endpoint
contractsRouter.get(
  "/sse",
  createSSEResource({
    loadState: async (): Promise<ContractsPageState> => {
      const [contracts, totalMonthly] = await Promise.all([
        getAllContracts(),
        getTotalMonthlyExpenditure(),
      ]);
      return { contracts, totalMonthly };
    },
    render: renderContractsContent,
    eventTypes: ["contract.*"],
  }),
);

// Form state type for create/edit pages
type ContractFormPageState = {
  contract?: Contract;
  action: string;
  submitLabel: string;
  formErrors: FormErrors | null;
};

// Contract form content renderer (used by SSE for create/edit pages)
const renderContractFormContent = (state: ContractFormPageState) => html`
  <div id="contract-form-content">
    ${Card({
      children: html`
        <div class="card-body">
          ${ContractForm({
            contract: state.contract,
            action: state.action,
            submitLabel: state.submitLabel,
            errors: state.formErrors,
          })}
        </div>
      `,
    })}
  </div>
`;

// Contract form resource (shared by create and edit pages)
const contractFormResource = createFormResource({
  path: "/app/contracts/form/sse",
  schema: contractFormSchema,
  command: createContractCommand,
  eventTypes: ["contract.*"],
  successRedirect: "/app/contracts",
  loadState: async (_user, c, cid) => {
    const editId = c.req.query("editId");
    const contract = editId ? await getContract(editId) : undefined;
    return {
      contract: contract || undefined,
      action: editId ? `/app/contracts/${editId}` : "/app/contracts",
      submitLabel: editId ? "Save Changes" : "Add Contract",
      formErrors: formErrorStore.getErrors(cid),
    };
  },
  render: renderContractFormContent,
});

// Contract form SSE endpoint
contractsRouter.post("/form/sse", contractFormResource.sseHandler);

// New contract page
contractsRouter.get("/new", async (c) => {
  const user = c.get("user")!;
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  return c.html(
    AppLayout({
      title: "Add Contract - All Eyes on Mum",
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: "Add New Contract",
          description: "Add a recurring contract or subscription to track",
        })}
        ${contractFormResource.container(
          renderContractFormContent({
            action: "/app/contracts",
            submitLabel: "Add Contract",
            formErrors: null,
          }),
        )}
      `,
    }),
  );
});

// Create contract
contractsRouter.post("/", contractFormResource.postHandler);

// Contract detail content renderer
const renderContractDetailContent = (state: ContractDetailPageState) => {
  const { contract } = state;
  const status = getContractStatus(contract.contractEndDate);

  return html`
    <div id="contract-detail-content">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <div class="flex items-start justify-between">
                <div>
                  <h2 class="card-title text-2xl">${contract.name}</h2>
                  ${contract.provider
                    ? html`<p class="text-base-content/60">
                        ${contract.provider}
                      </p>`
                    : ""}
                </div>
                <div class="flex gap-2">
                  <span class="badge ${status.class} badge-lg"
                    >${status.label}</span
                  >
                  ${contract.isUsageBased
                    ? html`<span class="badge badge-ghost badge-lg"
                        >Usage-based</span
                      >`
                    : ""}
                </div>
              </div>

              <div class="divider"></div>

              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-sm text-base-content/60">Monthly Amount</dt>
                  <dd class="text-xl font-semibold">
                    ${formatCurrency(contract.monthlyAmount)}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-base-content/60">Payment Method</dt>
                  <dd class="text-lg">
                    ${PAYMENT_METHOD_LABELS[contract.paymentMethod]}
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-base-content/60">Category</dt>
                  <dd>
                    <span class="badge badge-outline"
                      >${CATEGORY_LABELS[contract.category]}</span
                    >
                  </dd>
                </div>
                <div>
                  <dt class="text-sm text-base-content/60">Contract Period</dt>
                  <dd>
                    ${contract.contractStartDate
                      ? formatDate(contract.contractStartDate)
                      : "Not set"}
                    -
                    ${contract.contractEndDate
                      ? formatDate(contract.contractEndDate)
                      : "Ongoing"}
                  </dd>
                </div>
              </dl>

              ${contract.notes
                ? html`
                    <div class="divider"></div>
                    <div>
                      <h3 class="text-sm text-base-content/60 mb-1">Notes</h3>
                      <p class="whitespace-pre-wrap">${contract.notes}</p>
                    </div>
                  `
                : ""}

              <div class="divider"></div>

              <div class="flex gap-2">
                <a
                  href="/app/contracts/${contract.id}/edit"
                  class="btn btn-ghost"
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
        </div>

        <div>
          ${contract.isUsageBased
            ? html`
                <div class="card bg-base-100 shadow-xl">
                  <div class="card-body">
                    <h3 class="card-title">Usage Tracking</h3>
                    <p class="text-sm text-base-content/60">
                      This contract has usage-based pricing. Set up a reminder
                      to periodically check usage and ensure the monthly amount
                      reflects actual consumption.
                    </p>
                    <div class="mt-4">
                      ${Button({
                        href: `/app/reminders/new?linkedEntityType=contract&linkedEntityId=${contract.id}&title=Check%20${encodeURIComponent(contract.name)}%20usage`,
                        variant: "ghost",
                        children: "Create Usage Reminder",
                      })}
                    </div>
                  </div>
                </div>
              `
            : ""}
          ${contract.contractEndDate
            ? html`
                <div class="card bg-base-100 shadow-xl mt-4">
                  <div class="card-body">
                    <h3 class="card-title">Contract Renewal</h3>
                    <p class="text-sm text-base-content/60">
                      This contract ends on
                      ${formatDate(contract.contractEndDate)}.
                    </p>
                    <div class="mt-4">
                      ${Button({
                        href: `/app/reminders/new?linkedEntityType=contract&linkedEntityId=${contract.id}&title=Review%20${encodeURIComponent(contract.name)}%20renewal`,
                        variant: "ghost",
                        children: "Create Renewal Reminder",
                      })}
                    </div>
                  </div>
                </div>
              `
            : ""}
        </div>
      </div>

      ${DeleteConfirmModal(contract)}
    </div>
  `;
};

// Contract detail page
contractsRouter.get("/:id", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [contract, notifications, unreadCount] = await Promise.all([
    getContract(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!contract) {
    return c.redirect("/app/contracts");
  }

  return c.html(
    AppLayout({
      title: `${contract.name} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        <div class="mb-6">
          ${Button({
            href: "/app/contracts",
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
              Back to Contracts
            `,
          })}
        </div>
        <div data-init="@get('/app/contracts/${id}/sse')">
          ${renderContractDetailContent({
            contract,
          })}
        </div>
      `,
    }),
  );
});

// Contract detail SSE endpoint
contractsRouter.get("/:id/sse", async (c) => {
  const id = c.req.param("id");

  return createSSEResource({
    loadState: async (): Promise<ContractDetailPageState> => {
      const contract = await getContract(id);
      if (!contract) {
        throw new Error("Contract not found");
      }
      return { contract };
    },
    render: renderContractDetailContent,
    eventTypes: ["contract.*"],
    errorRedirect: "/app/contracts",
  })(c);
});

// Edit contract page
contractsRouter.get("/:id/edit", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  const [contract, notifications, unreadCount] = await Promise.all([
    getContract(id),
    getNotifications(user.id, 5),
    getUnreadCount(user.id),
  ]);

  if (!contract) {
    return c.redirect("/app/contracts");
  }

  return c.html(
    AppLayout({
      title: `Edit ${contract.name} - All Eyes on Mum`,
      user,
      notifications,
      unreadCount,
      children: html`
        ${PageHeader({
          title: `Edit ${contract.name}`,
          description: "Update contract details",
        })}
        ${contractFormResource.container(
          renderContractFormContent({
            contract,
            action: `/app/contracts/${id}`,
            submitLabel: "Save Changes",
            formErrors: null,
          }),
          `/app/contracts/form/sse?editId=${id}`,
        )}
      `,
    }),
  );
});

// Update contract
contractsRouter.post(
  "/:id",
  handleFormPost({
    schema: contractFormSchema,
    command: updateContractCommand,
    data: (parsed, c) => ({ id: c.req.param("id"), ...parsed }),
  }),
);

// Delete contract
contractsRouter.post("/:id/delete", async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");

  commandStore.enqueue(deleteContractCommand, user, { id });

  return c.body(null, 204);
});
