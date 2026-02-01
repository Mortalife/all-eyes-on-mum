import type { ContractCategory, PaymentMethod } from "../../types/contract.ts";
import { defineCommand } from "../cqrs/index.ts";
import { createContract, deleteContract, updateContract } from "./index.ts";

type CreateContractInput = {
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

type UpdateContractInput = {
  id: string;
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

type DeleteContractInput = {
  id: string;
};

// Creates a new contract
export const createContractCommand = defineCommand({
  type: "contract.create",
  emits: "contract.created",
  handler: async (user, data: CreateContractInput) => {
    const contract = await createContract(data, user.id);
    return { success: true, contract };
  },
});

// Updates an existing contract
export const updateContractCommand = defineCommand({
  type: "contract.update",
  emits: "contract.updated",
  handler: async (_user, data: UpdateContractInput) => {
    const { id, ...updateData } = data;
    const contract = await updateContract(id, updateData);
    return { success: !!contract, contract };
  },
});

// Deletes a contract
export const deleteContractCommand = defineCommand({
  type: "contract.delete",
  emits: "contract.deleted",
  handler: async (_user, data: DeleteContractInput) => {
    const success = await deleteContract(data.id);
    return { success, id: data.id };
  },
});
