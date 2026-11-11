// Browser-side push setup. Subscribing needs device APIs, so this is the one part that has to run in the browser.

declare global {
  interface Window {
    enablePush: (vapidPublicKey: string) => Promise<void>;
    disablePush: () => Promise<void>;
  }
}

// Shows a message in the push settings status region
const setStatus = (message: string) => {
  const status = document.getElementById("push-status");
  if (status) status.textContent = message;
};

// Converts a base64url VAPID key into the bytes PushManager expects
const base64UrlToBytes = (base64Url: string) =>
  Uint8Array.from(atob(base64Url.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );

// Sends JSON to the server, throwing if the request fails
const postJson = async (url: string, body: unknown) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
};

// Asks permission, subscribes this device to push and registers it with the server
window.enablePush = async (vapidPublicKey) => {
  if (!("PushManager" in window)) {
    setStatus(
      "This browser can't receive notifications. On iPhone, add the app to your Home Screen and open it from there.",
    );
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    setStatus(
      "Notifications are blocked. Allow them in your browser or phone settings.",
    );
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(vapidPublicKey),
    });
    await postJson("/app/notifications/push/subscribe", subscription.toJSON());
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("Couldn't turn on notifications. Please try again.");
  }
};

// Unsubscribes this device and tells the server to stop sending to it
window.disablePush = async () => {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    setStatus("This device isn't receiving notifications.");
    return;
  }

  try {
    await postJson("/app/notifications/push/unsubscribe", {
      endpoint: subscription.endpoint,
    });
    await subscription.unsubscribe();
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("Couldn't turn off notifications. Please try again.");
  }
};

export {};
