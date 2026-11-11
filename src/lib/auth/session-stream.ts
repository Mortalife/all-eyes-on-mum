import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { HonoContext } from "../../types/hono.ts";
import { redirectFragmentEvent } from "../datastar.ts";
import { validateSessionToken } from "./session.ts";
import { watchSessionRevocation } from "./session-events.ts";

// Shared lifecycle for both kinds of live update connection.
export const createSessionStream = (c: Context<HonoContext>) => {
  const token = getCookie(c, "session") ?? "";
  const user = c.get("user")!;
  const session = c.get("session")!;
  const encoder = new TextEncoder();
  const cleanup: Array<() => void> = [];
  let closed = false;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const close = (redirect = true) => {
    if (closed) return;
    closed = true;
    cleanup.forEach((fn) => fn());
    if (redirect)
      controller.enqueue(encoder.encode(redirectFragmentEvent("/auth/login")));
    controller.close();
  };
  const readable = new ReadableStream<Uint8Array>({
    start(value) {
      controller = value;
    },
    cancel() {
      // The consumer has already closed its side of the stream.
      if (closed) return;
      closed = true;
      cleanup.forEach((fn) => fn());
    },
  });
  const check = async () => {
    if (closed) return false;
    try {
      const current = await validateSessionToken(token);
      if (
        !current ||
        current.user.id !== user.id ||
        current.user.role !== user.role
      ) {
        close();
        return false;
      }
      return !closed;
    } catch {
      close(); // Fail closed if session storage cannot be checked.
      return false;
    }
  };
  const send = async (event: string) => {
    if (await check()) controller.enqueue(encoder.encode(event));
  };
  // Local revocation closes immediately; polling also catches other processes and idle expiry.
  cleanup.push(watchSessionRevocation(session.token, user.id, () => close()));
  const timer = setInterval(() => {
    void check();
  }, 15_000);
  timer.unref();
  cleanup.push(() => clearInterval(timer));
  const abort = () => close(false);
  c.req.raw.signal.addEventListener("abort", abort, { once: true });
  cleanup.push(() => c.req.raw.signal.removeEventListener("abort", abort));
  if (c.req.raw.signal.aborted) close(false);

  return {
    check,
    send,
    onClose(fn: () => void) {
      if (closed) fn();
      else cleanup.push(fn);
    },
    response: new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      },
    }),
  };
};
