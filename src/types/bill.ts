export type BillFrequency = "monthly" | "quarterly" | "annual" | "one-off";

export type BillCategory =
  | "utilities"
  | "insurance"
  | "subscriptions"
  | "housing"
  | "other";

export type Bill = {
  id: string;
  name: string;
  amount: number | null;
  frequency: BillFrequency;
  dueDate: string;
  category: BillCategory;
  notes: string | null;
  reminderDays: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type BillPayment = {
  id: string;
  billId: string;
  amount: number;
  paidAt: string;
  paidBy: string;
  notes: string | null;
};
