import type { ObservationCategory } from "../../types/observation.ts";
import { defineCommand } from "../cqrs/index.ts";
import { createObservation, deleteObservation } from "./index.ts";

type CreateObservationInput = {
  content: string;
  category: ObservationCategory;
  observedAt: string;
};

type DeleteObservationInput = {
  id: string;
};

// Creates a new observation
export const createObservationCommand = defineCommand({
  type: "observation.create",
  emits: "observation.created",
  handler: async (user, data: CreateObservationInput) => {
    const observation = await createObservation(data, user.id);
    return { success: true, observation };
  },
});

// Deletes an observation
export const deleteObservationCommand = defineCommand({
  type: "observation.delete",
  emits: "observation.deleted",
  handler: async (_user, data: DeleteObservationInput) => {
    const success = await deleteObservation(data.id);
    return { success, id: data.id };
  },
});
