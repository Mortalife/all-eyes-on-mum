import type {
  Bill,
  BillCategory,
  BillFrequency,
  BillPayment,
} from "../../types/bill.ts";
import { generateSecureRandomString } from "../auth/crypto.ts";
import { client } from "../db.ts";

export { initBillTables } from "./schema.ts";

type CreateBillData = {
  name: string;
  amount?: number | null;
  frequency: BillFrequency;
  dueDate: string;
  category: BillCategory;
  notes?: string | null;
  reminderDays?: number;
};

type UpdateBillData = {
  name?: string;
  amount?: number | null;
  frequency?: BillFrequency;
  dueDate?: string;
  category?: BillCategory;
  notes?: string | null;
  reminderDays?: number;
};

// Converts a database row to a Bill object
const rowToBill = (row: Record<string, unknown>): Bill => ({
  id: row.id as string,
  name: row.name as string,
  amount: row.amount as number | null,
  frequency: row.frequency as BillFrequency,
  dueDate: row.due_date as string,
  category: row.category as BillCategory,
  notes: row.notes as string | null,
  reminderDays: row.reminder_days as number,
  createdBy: row.created_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

// Converts a database row to a BillPayment object
const rowToBillPayment = (row: Record<string, unknown>): BillPayment => ({
  id: row.id as string,
  billId: row.bill_id as string,
  amount: row.amount as number,
  paidAt: row.paid_at as string,
  paidBy: row.paid_by as string,
  notes: row.notes as string | null,
});

// Calculates the next due date based on frequency
export const advanceDueDate = (
  currentDate: string,
  frequency: BillFrequency,
): string | null => {
  if (frequency === "one-off") {
    return null;
  }

  const date = new Date(currentDate);

  switch (frequency) {
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "annual":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split("T")[0];
};

// Creates a new bill
export const createBill = async (
  data: CreateBillData,
  userId: string,
): Promise<Bill> => {
  const id = generateSecureRandomString();
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO bill (id, name, amount, frequency, due_date, category, notes, reminder_days, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.name,
      data.amount ?? null,
      data.frequency,
      data.dueDate,
      data.category,
      data.notes ?? null,
      data.reminderDays ?? 7,
      userId,
      now,
      now,
    ],
  });

  return {
    id,
    name: data.name,
    amount: data.amount ?? null,
    frequency: data.frequency,
    dueDate: data.dueDate,
    category: data.category,
    notes: data.notes ?? null,
    reminderDays: data.reminderDays ?? 7,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
};

// Gets a single bill by ID
export const getBill = async (id: string): Promise<Bill | null> => {
  const result = await client.execute({
    sql: `SELECT id, name, amount, frequency, due_date, category, notes, reminder_days, created_by, created_at, updated_at
          FROM bill
          WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToBill(result.rows[0]);
};

// Gets all bills sorted by due date
export const getAllBills = async (): Promise<Bill[]> => {
  const result = await client.execute({
    sql: `SELECT id, name, amount, frequency, due_date, category, notes, reminder_days, created_by, created_at, updated_at
          FROM bill
          ORDER BY due_date ASC`,
    args: [],
  });

  return result.rows.map(rowToBill);
};

// Gets bills due within the specified number of days
export const getBillsDueSoon = async (days: number): Promise<Bill[]> => {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);

  const todayStr = today.toISOString().split("T")[0];
  const futureStr = futureDate.toISOString().split("T")[0];

  const result = await client.execute({
    sql: `SELECT id, name, amount, frequency, due_date, category, notes, reminder_days, created_by, created_at, updated_at
          FROM bill
          WHERE due_date >= ? AND due_date <= ?
          ORDER BY due_date ASC`,
    args: [todayStr, futureStr],
  });

  return result.rows.map(rowToBill);
};

// Gets overdue bills
export const getOverdueBills = async (): Promise<Bill[]> => {
  const today = new Date().toISOString().split("T")[0];

  const result = await client.execute({
    sql: `SELECT id, name, amount, frequency, due_date, category, notes, reminder_days, created_by, created_at, updated_at
          FROM bill
          WHERE due_date < ?
          ORDER BY due_date ASC`,
    args: [today],
  });

  return result.rows.map(rowToBill);
};

// Updates a bill
export const updateBill = async (
  id: string,
  data: UpdateBillData,
): Promise<Bill | null> => {
  const existing = await getBill(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updated = {
    name: data.name ?? existing.name,
    amount: data.amount !== undefined ? data.amount : existing.amount,
    frequency: data.frequency ?? existing.frequency,
    dueDate: data.dueDate ?? existing.dueDate,
    category: data.category ?? existing.category,
    notes: data.notes !== undefined ? data.notes : existing.notes,
    reminderDays: data.reminderDays ?? existing.reminderDays,
  };

  await client.execute({
    sql: `UPDATE bill
          SET name = ?, amount = ?, frequency = ?, due_date = ?, category = ?, notes = ?, reminder_days = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      updated.name,
      updated.amount,
      updated.frequency,
      updated.dueDate,
      updated.category,
      updated.notes,
      updated.reminderDays,
      now,
      id,
    ],
  });

  return {
    ...existing,
    ...updated,
    updatedAt: now,
  };
};

// Deletes a bill
export const deleteBill = async (id: string): Promise<boolean> => {
  const result = await client.execute({
    sql: "DELETE FROM bill WHERE id = ?",
    args: [id],
  });

  return result.rowsAffected > 0;
};

// Marks a bill as paid and advances the due date
export const markBillPaid = async (
  billId: string,
  amount: number,
  userId: string,
  notes?: string,
): Promise<{ payment: BillPayment; bill: Bill | null }> => {
  const bill = await getBill(billId);
  if (!bill) {
    throw new Error("Bill not found");
  }

  // Create payment record
  const paymentId = generateSecureRandomString();
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO bill_payment (id, bill_id, amount, paid_at, paid_by, notes)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [paymentId, billId, amount, now, userId, notes ?? null],
  });

  const payment: BillPayment = {
    id: paymentId,
    billId,
    amount,
    paidAt: now,
    paidBy: userId,
    notes: notes ?? null,
  };

  // Advance due date based on frequency
  const nextDueDate = advanceDueDate(bill.dueDate, bill.frequency);

  if (nextDueDate) {
    await client.execute({
      sql: "UPDATE bill SET due_date = ?, updated_at = ? WHERE id = ?",
      args: [nextDueDate, now, billId],
    });

    return {
      payment,
      bill: {
        ...bill,
        dueDate: nextDueDate,
        updatedAt: now,
      },
    };
  }

  // For one-off bills, don't advance the date (bill is "complete")
  return { payment, bill };
};

// Gets payment history for a bill
export const getBillPayments = async (
  billId: string,
): Promise<BillPayment[]> => {
  const result = await client.execute({
    sql: `SELECT id, bill_id, amount, paid_at, paid_by, notes
          FROM bill_payment
          WHERE bill_id = ?
          ORDER BY paid_at DESC`,
    args: [billId],
  });

  return result.rows.map(rowToBillPayment);
};

// Gets bills by category
export const getBillsByCategory = async (
  category: BillCategory,
): Promise<Bill[]> => {
  const result = await client.execute({
    sql: `SELECT id, name, amount, frequency, due_date, category, notes, reminder_days, created_by, created_at, updated_at
          FROM bill
          WHERE category = ?
          ORDER BY due_date ASC`,
    args: [category],
  });

  return result.rows.map(rowToBill);
};
