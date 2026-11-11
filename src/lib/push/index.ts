import {
  type PushSubscription,
  sendNotification,
  setVapidDetails,
  WebPushError,
} from "web-push";
import { env } from "../../env.ts";
import { client } from "../db.ts";

export { initPushSubscriptionTable } from "./schema.ts";

type PushPayload = {
  title: string;
  body: string;
  url: string;
};

// Push services keep undelivered messages for a day while the phone is offline
const PUSH_TTL_SECONDS = 60 * 60 * 24;

// Push services reply with these when a device has unsubscribed or the subscription expired
const GONE_STATUS_CODES = [404, 410];

export const VAPID_PUBLIC_KEY = env.VAPID_PUBLIC_KEY;
export const IS_PUSH_CONFIGURED = Boolean(
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY,
);

if (IS_PUSH_CONFIGURED) {
  setVapidDetails(
    `mailto:${env.ADMIN_EMAIL}`,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
}

// Sends a push message to every device the user has enabled, returning how many devices were targeted
export const sendPushToUser = async (
  userId: string,
  payload: PushPayload,
): Promise<number> => {
  if (!IS_PUSH_CONFIGURED) return 0;

  const subscriptions = await getUserPushSubscriptions(userId);
  await Promise.all(
    subscriptions.map((subscription) =>
      sendToSubscription(subscription, payload),
    ),
  );
  return subscriptions.length;
};

// Sends one push message, removing the subscription if the device no longer accepts it
const sendToSubscription = async (
  subscription: PushSubscription,
  payload: PushPayload,
) => {
  try {
    await sendNotification(subscription, JSON.stringify(payload), {
      TTL: PUSH_TTL_SECONDS,
    });
  } catch (error) {
    if (
      error instanceof WebPushError &&
      GONE_STATUS_CODES.includes(error.statusCode)
    ) {
      await client.execute({
        sql: "DELETE FROM push_subscription WHERE endpoint = ?",
        args: [subscription.endpoint],
      });
      return;
    }
    console.error("Failed to send push notification", error);
  }
};

// Gets all push subscriptions for a user
const getUserPushSubscriptions = async (
  userId: string,
): Promise<PushSubscription[]> => {
  const result = await client.execute({
    sql: "SELECT endpoint, p256dh, auth FROM push_subscription WHERE user_id = ?",
    args: [userId],
  });

  return result.rows.map((row) => ({
    endpoint: row.endpoint as string,
    keys: { p256dh: row.p256dh as string, auth: row.auth as string },
  }));
};

// Saves a device's push subscription for a user (re-subscribing a device updates it)
export const savePushSubscription = async (
  userId: string,
  subscription: PushSubscription,
) => {
  await client.execute({
    sql: `INSERT INTO push_subscription (endpoint, user_id, p256dh, auth, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET
            user_id = excluded.user_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth`,
    args: [
      subscription.endpoint,
      userId,
      subscription.keys.p256dh,
      subscription.keys.auth,
      Math.floor(Date.now() / 1000),
    ],
  });
};

// Removes a device's push subscription for a user
export const deletePushSubscription = async (
  userId: string,
  endpoint: string,
): Promise<boolean> => {
  const result = await client.execute({
    sql: "DELETE FROM push_subscription WHERE endpoint = ? AND user_id = ?",
    args: [endpoint, userId],
  });

  return result.rowsAffected > 0;
};
