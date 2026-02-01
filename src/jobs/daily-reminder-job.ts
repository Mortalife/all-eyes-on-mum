import { Job } from "sidequest";
import type { Appointment } from "../types/appointment.ts";
import type { Contract } from "../types/contract.ts";
import { getAllUsers } from "../lib/auth/user.ts";
import { getExpiringContracts } from "../lib/contracts/index.ts";
import { getAllAppointments } from "../lib/appointments/index.ts";
import { getDueReminders, triggerReminder } from "../lib/reminders/index.ts";
import {
  createNotification,
  hasNotificationForSourceToday,
} from "../lib/notifications/index.ts";

// Calculates the number of days between two dates (ignoring time)
const daysBetween = (date1: Date, date2: Date): number => {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Formats a time string for display (e.g., "2:30 PM")
const formatTime = (datetimeStr: string): string => {
  const date = new Date(datetimeStr);
  return date.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

// Creates a contract expiration notification for a user if one doesn't already exist today
const createContractExpirationNotification = async (
  userId: string,
  contract: Contract,
  daysUntilExpiry: number,
): Promise<boolean> => {
  const alreadyNotified = await hasNotificationForSourceToday(
    userId,
    "contract",
    contract.id,
  );
  if (alreadyNotified) {
    return false;
  }

  const isExpiringSoon = daysUntilExpiry <= 7;

  let title: string;
  let message: string;

  if (daysUntilExpiry === 0) {
    title = "Contract expires today";
    message = contract.name;
  } else if (daysUntilExpiry === 1) {
    title = "Contract expires tomorrow";
    message = contract.name;
  } else {
    title = `Contract expires in ${daysUntilExpiry} days`;
    message = contract.name;
  }

  await createNotification({
    userId,
    type: isExpiringSoon ? "warning" : "info",
    title,
    message,
    actionUrl: `/app/contracts/${contract.id}`,
    sourceType: "contract",
    sourceId: contract.id,
  });

  return true;
};

// Creates an appointment notification for a user if one doesn't already exist today
const createAppointmentNotification = async (
  userId: string,
  appointment: Appointment,
  daysUntil: number,
): Promise<boolean> => {
  const alreadyNotified = await hasNotificationForSourceToday(
    userId,
    "appointment",
    appointment.id,
  );
  if (alreadyNotified) {
    return false;
  }

  const isToday = daysUntil === 0;
  const isTomorrow = daysUntil === 1;

  let title: string;
  let message: string;
  const time = formatTime(appointment.datetime);

  if (isToday) {
    title = "Appointment today";
    message = `${appointment.title} at ${time}`;
  } else if (isTomorrow) {
    title = "Appointment tomorrow";
    message = `${appointment.title} at ${time}`;
  } else {
    title = `Appointment in ${daysUntil} days`;
    message = appointment.title;
  }

  await createNotification({
    userId,
    type: "info",
    title,
    message,
    actionUrl: `/app/appointments/${appointment.id}`,
    sourceType: "appointment",
    sourceId: appointment.id,
  });

  return true;
};

/**
 * Daily reminder job that checks for expiring contracts, due reminders, and upcoming appointments.
 * Runs on a scheduled basis (configured in jobs.ts) to notify users
 * about items within their configured reminder window.
 *
 * This job is idempotent - safe to run multiple times as it only
 * creates notifications for items that haven't been notified yet today.
 */
export class DailyReminderJob extends Job {
  /**
   * Executes the daily reminder check.
   * Processes contracts, reminders, and appointments, creating notifications for
   * all users when items need attention.
   */
  async run(): Promise<{
    success: boolean;
    checked: { contracts: number; reminders: number; appointments: number };
    created: { contracts: number; reminders: number; appointments: number };
  }> {
    console.log("Running daily reminder job...");

    const startTime = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await getAllUsers();
    if (users.length === 0) {
      console.log("No users found, skipping reminders");
      return {
        success: true,
        checked: { contracts: 0, reminders: 0, appointments: 0 },
        created: { contracts: 0, reminders: 0, appointments: 0 },
      };
    }

    let contractNotificationsCreated = 0;
    let reminderNotificationsCreated = 0;
    let appointmentNotificationsCreated = 0;

    // Process contracts expiring within 30 days
    const expiringContracts = await getExpiringContracts(30);

    for (const contract of expiringContracts) {
      if (!contract.contractEndDate) continue;

      const endDate = new Date(contract.contractEndDate);
      endDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = daysBetween(today, endDate);

      // Only notify within 30 days
      if (daysUntilExpiry >= 0 && daysUntilExpiry <= 30) {
        for (const user of users) {
          const created = await createContractExpirationNotification(
            user.id,
            contract,
            daysUntilExpiry,
          );
          if (created) {
            contractNotificationsCreated++;
          }
        }
      }
    }

    console.log(
      `Checked ${expiringContracts.length} expiring contracts, created ${contractNotificationsCreated} notifications`,
    );

    // Process due reminders
    const dueReminders = await getDueReminders();

    for (const reminder of dueReminders) {
      // Trigger the reminder for the first user (reminders are shared)
      // The triggerReminder function creates notifications and advances the due date
      if (users.length > 0) {
        const triggered = await triggerReminder(reminder.id, users[0].id);
        if (triggered) {
          reminderNotificationsCreated++;
        }
      }
    }

    console.log(
      `Checked ${dueReminders.length} due reminders, triggered ${reminderNotificationsCreated}`,
    );

    // Process appointments
    const allAppointments = await getAllAppointments();

    for (const appointment of allAppointments) {
      const appointmentDate = new Date(appointment.datetime);
      const appointmentDay = new Date(
        appointmentDate.getFullYear(),
        appointmentDate.getMonth(),
        appointmentDate.getDate(),
      );
      const daysUntil = daysBetween(today, appointmentDay);

      // Skip past appointments
      if (daysUntil < 0) {
        continue;
      }

      // Check if within reminder window (includes today)
      const isWithinReminderWindow = daysUntil <= appointment.reminderDays;

      if (isWithinReminderWindow) {
        for (const user of users) {
          const created = await createAppointmentNotification(
            user.id,
            appointment,
            daysUntil,
          );
          if (created) {
            appointmentNotificationsCreated++;
          }
        }
      }
    }

    console.log(
      `Checked ${allAppointments.length} appointments, created ${appointmentNotificationsCreated} notifications`,
    );

    const duration = Date.now() - startTime;
    console.log(`Daily reminder job completed in ${duration}ms`);

    return {
      success: true,
      checked: {
        contracts: expiringContracts.length,
        reminders: dueReminders.length,
        appointments: allAppointments.length,
      },
      created: {
        contracts: contractNotificationsCreated,
        reminders: reminderNotificationsCreated,
        appointments: appointmentNotificationsCreated,
      },
    };
  }
}
