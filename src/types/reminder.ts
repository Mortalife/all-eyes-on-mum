export type ReminderFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "annually"
  | "one-off";

export type LinkedEntityType = "contract" | null;

export type RecurringReminder = {
  id: string;
  title: string;
  description: string | null;
  frequency: ReminderFrequency;
  nextDue: string;
  linkedEntityType: LinkedEntityType;
  linkedEntityId: string | null;
  isActive: boolean;
  lastTriggered: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
