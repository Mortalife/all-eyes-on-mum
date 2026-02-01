export type PaymentMethod = "direct_debit" | "standing_order" | "manual";

export type ContractCategory =
  | "utilities"
  | "insurance"
  | "subscriptions"
  | "housing"
  | "other";

export type Contract = {
  id: string;
  name: string;
  provider: string | null;
  monthlyAmount: number;
  paymentMethod: PaymentMethod;
  contractStartDate: string | null;
  contractEndDate: string | null;
  category: ContractCategory;
  isUsageBased: boolean;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
