import type { Context } from "hono";
import type { z } from "zod";
import type { HonoContext } from "../../types/hono.ts";
import type { CommandDefinition } from "./define.ts";
import { commandStore } from "./command-store.ts";
import { eventBus } from "./event-bus.ts";
import { formErrorStore } from "./form-errors.ts";

type HandleFormPostOptions<TSchema extends z.ZodType, TData> = {
  schema: TSchema;
  command: CommandDefinition<TData, unknown>;
  data?: (parsed: z.infer<TSchema>, c: Context<HonoContext>) => TData;
};

// Creates a Hono handler that validates form input, stores errors via SSE on failure,
// and enqueues a command on success. Always returns 204.
export const handleFormPost = <TSchema extends z.ZodType, TData>(
  options: HandleFormPostOptions<TSchema, TData>,
) => {
  return async (c: Context<HonoContext>) => {
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
};
