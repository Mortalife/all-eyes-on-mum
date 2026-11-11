import type { PushSubscription } from "web-push";
import { defineCommand } from "../cqrs/index.ts";
import { createNotification } from "../notifications/index.ts";
import {
  deletePushSubscription,
  savePushSubscription,
  sendPushToUser,
} from "./index.ts";

// Registers the current device to receive push notifications
export const subscribePushCommand = defineCommand({
  type: "push.subscribe",
  emits: "notification.updated",
  handler: async (user, data: { subscription: PushSubscription }) => {
    await savePushSubscription(user.id, data.subscription);

    await createNotification({
      userId: user.id,
      type: "success",
      title: "Phone notifications on",
      message:
        "This device will now get alerts for appointments, contracts and reminders.",
    });

    return { success: true };
  },
});

// Stops the current device receiving push notifications
export const unsubscribePushCommand = defineCommand({
  type: "push.unsubscribe",
  emits: "notification.updated",
  handler: async (user, data: { endpoint: string }) => {
    const success = await deletePushSubscription(user.id, data.endpoint);

    await createNotification({
      userId: user.id,
      type: "info",
      title: "Phone notifications off",
      message: "This device will no longer get alerts.",
    });

    return { success };
  },
});

// Sends a test push to all of the user's devices, warning if none are set up
export const sendTestPushCommand = defineCommand({
  type: "push.sendTest",
  emits: "notification.updated",
  handler: async (user) => {
    const deviceCount = await sendPushToUser(user.id, {
      title: "Test notification",
      body: "Phone notifications are working.",
      url: "/app/notifications",
    });

    if (deviceCount === 0) {
      await createNotification({
        userId: user.id,
        type: "warning",
        title: "No devices set up",
        message: "Turn on phone notifications on a device first.",
      });
    }

    return { success: deviceCount > 0, deviceCount };
  },
});
