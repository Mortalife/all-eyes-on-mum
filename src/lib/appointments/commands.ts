import type { AppointmentType } from "../../types/appointment.ts";
import { defineCommand } from "../cqrs/index.ts";
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
} from "./index.ts";

type CreateAppointmentInput = {
  title: string;
  description?: string | null;
  datetime: string;
  endTime?: string | null;
  location?: string | null;
  type: AppointmentType;
  reminderDays?: number;
};

type UpdateAppointmentInput = {
  id: string;
  title?: string;
  description?: string | null;
  datetime?: string;
  endTime?: string | null;
  location?: string | null;
  type?: AppointmentType;
  reminderDays?: number;
};

type DeleteAppointmentInput = {
  id: string;
};

// Creates a new appointment
export const createAppointmentCommand = defineCommand({
  type: "appointment.create",
  emits: "appointment.created",
  handler: async (user, data: CreateAppointmentInput) => {
    const appointment = await createAppointment(data, user.id);
    return { success: true, appointment };
  },
});

// Updates an existing appointment
export const updateAppointmentCommand = defineCommand({
  type: "appointment.update",
  emits: "appointment.updated",
  handler: async (_user, data: UpdateAppointmentInput) => {
    const { id, ...updateData } = data;
    const appointment = await updateAppointment(id, updateData);
    return { success: !!appointment, appointment };
  },
});

// Deletes an appointment
export const deleteAppointmentCommand = defineCommand({
  type: "appointment.delete",
  emits: "appointment.deleted",
  handler: async (_user, data: DeleteAppointmentInput) => {
    const success = await deleteAppointment(data.id);
    return { success, id: data.id };
  },
});
