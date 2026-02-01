import type {
  Contract,
  ContractCategory,
  PaymentMethod,
} from "../../types/contract.ts";
import { generateSecureRandomString } from "../auth/crypto.ts";
import { client } from "../db.ts";

export { initContractTables } from "./schema.ts";

type CreateContractData = {
  name: string;
  provider?: string | null;
  monthlyAmount: number;
  paymentMethod?: PaymentMethod;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  category: ContractCategory;
  isUsageBased?: boolean;
  notes?: string | null;
};

type UpdateContractData = {
  name?: string;
  provider?: string | null;
  monthlyAmount?: number;
  paymentMethod?: PaymentMethod;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  category?: ContractCategory;
  isUsageBased?: boolean;
  notes?: string | null;
};

// Converts a database row to a Contract object
const rowToContract = (row: Record<string, unknown>): Contract => ({
  id: row.id as string,
  name: row.name as string,
  provider: row.provider as string | null,
  monthlyAmount: row.monthly_amount as number,
  paymentMethod: row.payment_method as PaymentMethod,
  contractStartDate: row.contract_start_date as string | null,
  contractEndDate: row.contract_end_date as string | null,
  category: row.category as ContractCategory,
  isUsageBased: Boolean(row.is_usage_based),
  notes: row.notes as string | null,
  createdBy: row.created_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

// Creates a new contract
export const createContract = async (
  data: CreateContractData,
  userId: string,
): Promise<Contract> => {
  const id = generateSecureRandomString();
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO contract (id, name, provider, monthly_amount, payment_method, contract_start_date, contract_end_date, category, is_usage_based, notes, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.name,
      data.provider ?? null,
      data.monthlyAmount,
      data.paymentMethod ?? "direct_debit",
      data.contractStartDate ?? null,
      data.contractEndDate ?? null,
      data.category,
      data.isUsageBased ? 1 : 0,
      data.notes ?? null,
      userId,
      now,
      now,
    ],
  });

  return {
    id,
    name: data.name,
    provider: data.provider ?? null,
    monthlyAmount: data.monthlyAmount,
    paymentMethod: data.paymentMethod ?? "direct_debit",
    contractStartDate: data.contractStartDate ?? null,
    contractEndDate: data.contractEndDate ?? null,
    category: data.category,
    isUsageBased: data.isUsageBased ?? false,
    notes: data.notes ?? null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
};

// Gets a single contract by ID
export const getContract = async (id: string): Promise<Contract | null> => {
  const result = await client.execute({
    sql: `SELECT id, name, provider, monthly_amount, payment_method, contract_start_date, contract_end_date, category, is_usage_based, notes, created_by, created_at, updated_at
          FROM contract
          WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return rowToContract(result.rows[0]);
};

// Gets all contracts sorted by name
export const getAllContracts = async (): Promise<Contract[]> => {
  const result = await client.execute({
    sql: `SELECT id, name, provider, monthly_amount, payment_method, contract_start_date, contract_end_date, category, is_usage_based, notes, created_by, created_at, updated_at
          FROM contract
          ORDER BY name ASC`,
    args: [],
  });

  return result.rows.map(rowToContract);
};

// Gets all active contracts (no end date or end date in future)
export const getActiveContracts = async (): Promise<Contract[]> => {
  const today = new Date().toISOString().split("T")[0];

  const result = await client.execute({
    sql: `SELECT id, name, provider, monthly_amount, payment_method, contract_start_date, contract_end_date, category, is_usage_based, notes, created_by, created_at, updated_at
          FROM contract
          WHERE contract_end_date IS NULL OR contract_end_date >= ?
          ORDER BY name ASC`,
    args: [today],
  });

  return result.rows.map(rowToContract);
};

// Gets contracts expiring within the specified number of days
export const getExpiringContracts = async (
  withinDays: number,
): Promise<Contract[]> => {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + withinDays);

  const todayStr = today.toISOString().split("T")[0];
  const futureStr = futureDate.toISOString().split("T")[0];

  const result = await client.execute({
    sql: `SELECT id, name, provider, monthly_amount, payment_method, contract_start_date, contract_end_date, category, is_usage_based, notes, created_by, created_at, updated_at
          FROM contract
          WHERE contract_end_date IS NOT NULL AND contract_end_date >= ? AND contract_end_date <= ?
          ORDER BY contract_end_date ASC`,
    args: [todayStr, futureStr],
  });

  return result.rows.map(rowToContract);
};

// Gets contracts by category
export const getContractsByCategory = async (
  category: ContractCategory,
): Promise<Contract[]> => {
  const result = await client.execute({
    sql: `SELECT id, name, provider, monthly_amount, payment_method, contract_start_date, contract_end_date, category, is_usage_based, notes, created_by, created_at, updated_at
          FROM contract
          WHERE category = ?
          ORDER BY name ASC`,
    args: [category],
  });

  return result.rows.map(rowToContract);
};

// Gets total monthly expenditure for all active contracts
export const getTotalMonthlyExpenditure = async (): Promise<number> => {
  const today = new Date().toISOString().split("T")[0];

  const result = await client.execute({
    sql: `SELECT COALESCE(SUM(monthly_amount), 0) as total
          FROM contract
          WHERE contract_end_date IS NULL OR contract_end_date >= ?`,
    args: [today],
  });

  return (result.rows[0]?.total as number) || 0;
};

// Updates a contract
export const updateContract = async (
  id: string,
  data: UpdateContractData,
): Promise<Contract | null> => {
  const existing = await getContract(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updated = {
    name: data.name ?? existing.name,
    provider: data.provider !== undefined ? data.provider : existing.provider,
    monthlyAmount: data.monthlyAmount ?? existing.monthlyAmount,
    paymentMethod: data.paymentMethod ?? existing.paymentMethod,
    contractStartDate:
      data.contractStartDate !== undefined
        ? data.contractStartDate
        : existing.contractStartDate,
    contractEndDate:
      data.contractEndDate !== undefined
        ? data.contractEndDate
        : existing.contractEndDate,
    category: data.category ?? existing.category,
    isUsageBased: data.isUsageBased ?? existing.isUsageBased,
    notes: data.notes !== undefined ? data.notes : existing.notes,
  };

  await client.execute({
    sql: `UPDATE contract
          SET name = ?, provider = ?, monthly_amount = ?, payment_method = ?, contract_start_date = ?, contract_end_date = ?, category = ?, is_usage_based = ?, notes = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      updated.name,
      updated.provider,
      updated.monthlyAmount,
      updated.paymentMethod,
      updated.contractStartDate,
      updated.contractEndDate,
      updated.category,
      updated.isUsageBased ? 1 : 0,
      updated.notes,
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

// Deletes a contract
export const deleteContract = async (id: string): Promise<boolean> => {
  const result = await client.execute({
    sql: "DELETE FROM contract WHERE id = ?",
    args: [id],
  });

  return result.rowsAffected > 0;
};
