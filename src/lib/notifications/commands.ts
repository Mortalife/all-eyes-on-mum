import { defineCommand } from "../cqrs/index.ts";
import {
  clearAllNotifications,
  dismissNotification,
  markAllAsRead,
  markAsRead,
} from "./index.ts";

// Marks a single notification as read
export const markNotificationReadCommand = defineCommand({
  type: "notification.markRead",
  emits: "notification.updated",
  handler: async (_user, data: { notificationId: string; userId: string }) => {
    const success = await markAsRead(data.notificationId, data.userId);
    return { success, notificationId: data.notificationId };
  },
});

// Marks all notifications as read for a user
export const markAllNotificationsReadCommand = defineCommand({
  type: "notification.markAllRead",
  emits: "notification.updated",
  handler: async (_user, data: { userId: string }) => {
    const count = await markAllAsRead(data.userId);
    return { success: true, count };
  },
});

// Dismisses a single notification
export const dismissNotificationCommand = defineCommand({
  type: "notification.dismiss",
  emits: "notification.updated",
  handler: async (_user, data: { notificationId: string; userId: string }) => {
    const success = await dismissNotification(data.notificationId, data.userId);
    return { success, notificationId: data.notificationId };
  },
});

// Clears all notifications for a user
export const clearAllNotificationsCommand = defineCommand({
  type: "notification.clearAll",
  emits: "notification.updated",
  handler: async (_user, data: { userId: string }) => {
    const count = await clearAllNotifications(data.userId);
    return { success: true, count };
  },
});
