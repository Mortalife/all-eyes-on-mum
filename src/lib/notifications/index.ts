import type {
  Notification,
  NotificationSourceType,
  NotificationType,
} from "../../types/notification.ts";
import { generateSecureRandomString } from "../auth/crypto.ts";
import { client } from "../db.ts";

export { initNotificationTable } from "./schema.ts";

type CreateNotificationData = {
  userId: string;
  type: NotificationType;
  title?: string;
  message: string;
  actionUrl?: string;
  sourceType?: NotificationSourceType;
  sourceId?: string;
};

// Converts a database row to a Notification object
const rowToNotification = (row: Record<string, unknown>): Notification => ({
  id: row.id as string,
  userId: row.user_id as string,
  type: row.type as NotificationType,
  title: row.title as string | null,
  message: row.message as string,
  actionUrl: row.action_url as string | null,
  read: (row.read as number) === 1,
  createdAt: new Date((row.created_at as number) * 1000).toISOString(),
  sourceType: row.source_type as NotificationSourceType | null,
  sourceId: row.source_id as string | null,
});

// Creates a new notification for a user
export const createNotification = async (
  data: CreateNotificationData,
): Promise<Notification> => {
  const id = generateSecureRandomString();
  const now = Math.floor(Date.now() / 1000);

  await client.execute({
    sql: `INSERT INTO notification (id, user_id, type, title, message, action_url, read, created_at, source_type, source_id)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    args: [
      id,
      data.userId,
      data.type,
      data.title || null,
      data.message,
      data.actionUrl || null,
      now,
      data.sourceType || null,
      data.sourceId || null,
    ],
  });

  return {
    id,
    userId: data.userId,
    type: data.type,
    title: data.title || null,
    message: data.message,
    actionUrl: data.actionUrl || null,
    read: false,
    createdAt: new Date(now * 1000).toISOString(),
    sourceType: data.sourceType || null,
    sourceId: data.sourceId || null,
  };
};

// Gets unread notifications for a user
export const getUnreadNotifications = async (
  userId: string,
): Promise<Notification[]> => {
  const result = await client.execute({
    sql: `SELECT id, user_id, type, title, message, action_url, read, created_at, source_type, source_id
          FROM notification
          WHERE user_id = ? AND read = 0
          ORDER BY created_at DESC`,
    args: [userId],
  });

  return result.rows.map(rowToNotification);
};

// Gets recent notifications for a user with optional limit
export const getNotifications = async (
  userId: string,
  limit = 20,
): Promise<Notification[]> => {
  const result = await client.execute({
    sql: `SELECT id, user_id, type, title, message, action_url, read, created_at, source_type, source_id
          FROM notification
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [userId, limit],
  });

  return result.rows.map(rowToNotification);
};

// Gets the count of unread notifications for a user
export const getUnreadCount = async (userId: string): Promise<number> => {
  const result = await client.execute({
    sql: "SELECT COUNT(*) as count FROM notification WHERE user_id = ? AND read = 0",
    args: [userId],
  });

  return (result.rows[0]?.count as number) || 0;
};

// Marks a single notification as read
export const markAsRead = async (
  notificationId: string,
  userId: string,
): Promise<boolean> => {
  const result = await client.execute({
    sql: "UPDATE notification SET read = 1 WHERE id = ? AND user_id = ?",
    args: [notificationId, userId],
  });

  return result.rowsAffected > 0;
};

// Marks all notifications as read for a user
export const markAllAsRead = async (userId: string): Promise<number> => {
  const result = await client.execute({
    sql: "UPDATE notification SET read = 1 WHERE user_id = ? AND read = 0",
    args: [userId],
  });

  return result.rowsAffected;
};

// Dismisses (deletes) a single notification
export const dismissNotification = async (
  notificationId: string,
  userId: string,
): Promise<boolean> => {
  const result = await client.execute({
    sql: "DELETE FROM notification WHERE id = ? AND user_id = ?",
    args: [notificationId, userId],
  });

  return result.rowsAffected > 0;
};

// Clears all notifications for a user
export const clearAllNotifications = async (
  userId: string,
): Promise<number> => {
  const result = await client.execute({
    sql: "DELETE FROM notification WHERE user_id = ?",
    args: [userId],
  });

  return result.rowsAffected;
};

// Checks if a notification with the given source already exists today for a user
export const hasNotificationForSourceToday = async (
  userId: string,
  sourceType: NotificationSourceType,
  sourceId: string,
): Promise<boolean> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTimestamp = Math.floor(todayStart.getTime() / 1000);

  const result = await client.execute({
    sql: `SELECT 1 FROM notification
          WHERE user_id = ? AND source_type = ? AND source_id = ? AND created_at >= ?
          LIMIT 1`,
    args: [userId, sourceType, sourceId, todayStartTimestamp],
  });

  return result.rows.length > 0;
};
