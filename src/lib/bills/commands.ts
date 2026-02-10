import type { BillCategory, BillFrequency } from "../../types/bill.ts";
import { defineCommand } from "../cqrs/index.ts";
import { createNotification } from "../notifications/index.ts";
import { createBill, deleteBill, markBillPaid, updateBill } from "./index.ts";

type CreateBillInput = {
  name: string;
  amount?: number | null;
  frequency: BillFrequency;
  dueDate: string;
  category: BillCategory;
  notes?: string | null;
  reminderDays?: number;
};

type UpdateBillInput = {
  id: string;
  name?: string;
  amount?: number | null;
  frequency?: BillFrequency;
  dueDate?: string;
  category?: BillCategory;
  notes?: string | null;
  reminderDays?: number;
};

type MarkBillPaidInput = {
  billId: string;
  amount: number;
  notes?: string;
};

type DeleteBillInput = {
  id: string;
};

// Creates a new bill
export const createBillCommand = defineCommand({
  type: "bill.create",
  emits: "bill.created",
  handler: async (user, data: CreateBillInput) => {
    const bill = await createBill(data, user.id);
    await createNotification({
      userId: user.id,
      type: "success",
      title: "Bill added",
      message: `${data.name} has been added.`,
    });
    return { success: true, bill };
  },
});

// Updates an existing bill
export const updateBillCommand = defineCommand({
  type: "bill.update",
  emits: "bill.updated",
  handler: async (user, data: UpdateBillInput) => {
    const { id, ...updateData } = data;
    const bill = await updateBill(id, updateData);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Bill updated",
      message: `${updateData.name || "Bill"} has been updated.`,
    });
    return { success: !!bill, bill };
  },
});

// Marks a bill as paid
export const markBillPaidCommand = defineCommand({
  type: "bill.markPaid",
  emits: "bill.paid",
  handler: async (user, data: MarkBillPaidInput) => {
    const result = await markBillPaid(
      data.billId,
      data.amount,
      user.id,
      data.notes,
    );
    await createNotification({
      userId: user.id,
      type: "success",
      title: "Bill paid",
      message: `Payment of ${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(data.amount)} recorded.`,
    });
    return { success: true, payment: result.payment, bill: result.bill };
  },
});

// Deletes a bill
export const deleteBillCommand = defineCommand({
  type: "bill.delete",
  emits: "bill.deleted",
  handler: async (user, data: DeleteBillInput) => {
    const success = await deleteBill(data.id);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Bill deleted",
      message: "The bill has been removed.",
    });
    return { success, id: data.id };
  },
});
