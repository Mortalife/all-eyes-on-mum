import { Hono } from "hono";
import { commandStore } from "../../lib/cqrs/index.ts";
import {
  dismissNotificationCommand,
  markAllNotificationsReadCommand,
  markNotificationReadCommand,
} from "../../lib/notifications/commands.ts";
import type { HonoContext } from "../../types/hono.ts";

export const notificationsRouter = new Hono<HonoContext>();

// Marks a single notification as read
notificationsRouter.post("/:id/read", async (c) => {
  const user = c.get("user")!;
  const notificationId = c.req.param("id");

  commandStore.enqueue(markNotificationReadCommand, user, {
    notificationId,
    userId: user.id,
  });

  return c.body(null, 204);
});

// Marks all notifications as read
notificationsRouter.post("/read-all", async (c) => {
  const user = c.get("user")!;

  commandStore.enqueue(markAllNotificationsReadCommand, user, {
    userId: user.id,
  });

  return c.body(null, 204);
});

// Dismisses a single notification
notificationsRouter.post("/:id/dismiss", async (c) => {
  const user = c.get("user")!;
  const notificationId = c.req.param("id");

  commandStore.enqueue(dismissNotificationCommand, user, {
    notificationId,
    userId: user.id,
  });

  return c.body(null, 204);
});
