import type { Context } from "hono";
import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { z } from "zod";
import type { HonoContext } from "../../types/hono.ts";
import type { User } from "../../types/user.ts";
import { patchElementEvent, redirectFragmentEvent } from "../datastar.ts";
import { commandStore } from "./command-store.ts";
import type { CommandDefinition } from "./define.ts";
import { eventBus } from "./event-bus.ts";
import { formErrorStore } from "./form-errors.ts";
import { stream } from "hono/streaming";

type FormResourceOptions<TSchema extends z.ZodType, TState, TData> = {
  path: string;
  schema: TSchema;
  command: CommandDefinition<TData, unknown>;
  data?: (parsed: z.infer<TSchema>, c: Context<HonoContext>) => TData;
  eventTypes: string[];
  successRedirect?: string;
  errorRedirect?: string;
  loadState: (
    user: User,
    c: Context<HonoContext>,
    connectionId: string,
  ) => Promise<TState>;
  render: (state: TState) => HtmlEscapedString | Promise<HtmlEscapedString>;
};

// Creates a form resource that manages the full lifecycle of a validated form:
// container div (client-side cid + SSE), SSE handler, and POST handler.
export const createFormResource = <
  TSchema extends z.ZodType,
  TState,
  TData = z.infer<TSchema>,
>(
  options: FormResourceOptions<TSchema, TState, TData>,
) => {
  // Wraps children in a div with client-side cid signal and @post SSE init.
  // Pass sseUrl to override the default path (e.g. to add query params).
  const container = (
    children: HtmlEscapedString | Promise<HtmlEscapedString>,
    sseUrl?: string,
  ) => {
    const url = sseUrl || options.path;
    return html`
      <div
        data-signals="{cid: crypto.randomUUID().slice(0,8)}"
        data-init="@post('${url}')"
      >
        ${children}
      </div>
    `;
  };

  // Hono handler for form POST submission. Validates input against the schema,
  // stores errors on failure, enqueues the command on success. Returns 204.
  const postHandler = async (c: Context<HonoContext>) => {
    const user = c.get("user")!;
    const body = await c.req.json();
    const connectionId = body.cid;

    const result = options.schema.safeParse(body);
    if (!result.success) {
      formErrorStore.setErrors(connectionId, result.error.flatten());
      eventBus.publish(`connection:${connectionId}`, {
        type: "form.validationError",
      });
      return c.body(null, 204);
    }

    formErrorStore.clearErrors(connectionId);
    const data = options.data
      ? options.data(result.data, c)
      : (result.data as TData);
    commandStore.enqueue(options.command, user, data);

    return c.body(null, 204);
  };

  // Hono handler for the SSE endpoint. Reads cid from the POST body,
  // streams initial state, and re-renders on matching events.
  const sseHandler = async (c: Context<HonoContext>) => {
    const user = c.get("user");
    if (!user) {
      return stream(c, async (stream) => {
        stream.write(redirectFragmentEvent("/auth/login"));
      });
    }

    const body = await c.req.json();
    const connectionId: string = body.cid || "";

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendState = async () => {
      try {
        const state = await options.loadState(user, c, connectionId);
        const rendered = await options.render(state);
        await writer.write(encoder.encode(patchElementEvent(rendered)));
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

    sendState();

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

    let unsubscribeConnection: (() => void) | undefined;
    if (connectionId) {
      unsubscribeConnection = eventBus.subscribe(
        `connection:${connectionId}`,
        () => {
          sendState();
        },
      );
    }

    c.req.raw.signal.addEventListener("abort", () => {
      unsubscribeUser();
      unsubscribeConnection?.();
      if (connectionId) {
        formErrorStore.clearErrors(connectionId);
      }
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

  return { container, postHandler, sseHandler };
};
