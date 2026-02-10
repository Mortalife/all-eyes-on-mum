import type { ObservationCategory } from "../../types/observation.ts";
import { defineCommand } from "../cqrs/index.ts";
import { createNotification } from "../notifications/index.ts";
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
    await createNotification({
      userId: user.id,
      type: "success",
      title: "Observation recorded",
      message: "A new observation has been added.",
    });
    return { success: true, observation };
  },
});

// Deletes an observation
export const deleteObservationCommand = defineCommand({
  type: "observation.delete",
  emits: "observation.deleted",
  handler: async (user, data: DeleteObservationInput) => {
    const success = await deleteObservation(data.id);
    await createNotification({
      userId: user.id,
      type: "info",
      title: "Observation deleted",
      message: "The observation has been removed.",
    });
    return { success, id: data.id };
  },
});
