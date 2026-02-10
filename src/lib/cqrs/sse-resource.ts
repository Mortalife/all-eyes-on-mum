import type { Context } from "hono";
import type { HtmlEscapedString } from "hono/utils/html";
import type { HonoContext } from "../../types/hono.ts";
import type { User } from "../../types/user.ts";
import { patchElementEvent, redirectFragmentEvent } from "../datastar.ts";
import { eventBus } from "./event-bus.ts";
import { stream } from "hono/streaming";

type SSEResourceOptions<TState> = {
  loadState: (user: User, c: Context<HonoContext>) => Promise<TState>;
  render: (state: TState) => HtmlEscapedString | Promise<HtmlEscapedString>;
  eventTypes: string[];
  successRedirect?: string;
  errorRedirect?: string;
};

// Creates an SSE handler that re-renders on events
export const createSSEResource = <TState>(
  options: SSEResourceOptions<TState>,
) => {
  return async (c: Context<HonoContext>) => {
    const user = c.get("user");
    if (!user) {
      return stream(c, async (stream) => {
        stream.write(redirectFragmentEvent("/auth/login"));
      });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Sends the current state to the client
    const sendState = async () => {
      try {
        const state = await options.loadState(user, c);
        const html = await options.render(state);
        await writer.write(encoder.encode(patchElementEvent(html)));
      } catch (error) {
        console.error("SSE render error:", error);
        if (options.errorRedirect) {
          try {
            await writer.write(
              encoder.encode(redirectFragmentEvent(options.errorRedirect)),
            );
          } catch {
            // Writer may be closed
          }
        }
      }
    };

    // Sends initial state
    sendState();

    // Subscribes to user-scoped events and re-renders
    const unsubscribeUser = eventBus.subscribeToUser(user.id, (payload) => {
      const event = payload as { type: string };
      if (
        options.eventTypes.some((t) =>
          event.type.startsWith(t.replace("*", "")),
        )
      ) {
        if (options.successRedirect) {
          writer
            .write(
              encoder.encode(redirectFragmentEvent(options.successRedirect)),
            )
            .catch(() => {});
          return;
        }
        sendState();
      }
    });

    // Cleans up on close
    c.req.raw.signal.addEventListener("abort", () => {
      unsubscribeUser();
      writer.close();
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  };
};
