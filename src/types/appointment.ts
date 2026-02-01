export type AppointmentType =
  | "medical"
  | "home"
  | "financial"
  | "social"
  | "other";

export type Appointment = {
  id: string;
  title: string;
  description: string | null;
  datetime: string;
  endTime: string | null;
  location: string | null;
  type: AppointmentType;
  reminderDays: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
