import type { Context } from "hono";
import type { HtmlEscapedString } from "hono/utils/html";
import type { HonoContext } from "../../types/hono.ts";
import type { User } from "../../types/user.ts";
import { patchElementEvent } from "../datastar.ts";
import { eventBus } from "./event-bus.ts";

type SSEResourceOptions<TState> = {
  loadState: (user: User, c: Context<HonoContext>) => Promise<TState>;
  render: (state: TState) => HtmlEscapedString | Promise<HtmlEscapedString>;
  eventTypes: string[];
};

// Creates an SSE handler that re-renders on events
export const createSSEResource = <TState>(
  options: SSEResourceOptions<TState>,
) => {
  return async (c: Context<HonoContext>) => {
    const user = c.get("user");
    if (!user) {
      return c.text("Unauthorized", 401);
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
      }
    };

    // Sends initial state
    sendState();

    // Subscribes to events and re-renders
    const unsubscribe = eventBus.subscribeToUser(user.id, (payload) => {
      const event = payload as { type: string };
      if (
        options.eventTypes.some((t) =>
          event.type.startsWith(t.replace("*", "")),
        )
      ) {
        sendState();
      }
    });

    // Cleans up on close
    c.req.raw.signal.addEventListener("abort", () => {
      unsubscribe();
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
