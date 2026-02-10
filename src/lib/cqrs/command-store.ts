import { createNotification } from "../notifications/index.ts";
import type { User } from "../../types/user.ts";
import type { CommandDefinition } from "./define.ts";
import { eventBus } from "./event-bus.ts";

type QueuedCommand = {
  definition: CommandDefinition<unknown, unknown>;
  user: User;
  data: unknown;
};

// In-memory command queue with async processing
class CommandStore {
  private queue: QueuedCommand[] = [];
  private processing = false;
  private running = false;

  // Enqueues a command for processing
  enqueue<TData, TResult>(
    definition: CommandDefinition<TData, TResult>,
    user: User,
    data: TData,
  ): void {
    this.queue.push({
      definition: definition as CommandDefinition<unknown, unknown>,
      user,
      data,
    });
  }

  // Starts the command processor loop
  start(): void {
    if (this.running) return;
    this.running = true;
    this.processLoop();
  }

  // Stops the command processor
  stop(): void {
    this.running = false;
  }

  // Main processing loop
  private async processLoop(): Promise<void> {
    while (this.running) {
      if (this.queue.length > 0 && !this.processing) {
        await this.processNext();
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  // Processes the next command in the queue
  private async processNext(): Promise<void> {
    const command = this.queue.shift();
    if (!command) return;

    this.processing = true;
    try {
      const result = await command.definition.handler(
        command.user,
        command.data,
      );

      // Emit the command's own event
      if (command.definition.emits) {
        eventBus.publishToUser(command.user.id, {
          type: command.definition.emits,
          data: result,
        });
      }

      // Emit notification event so the bell SSE updates.
      // Skip if the command already emits a notification event.
      if (!command.definition.emits.startsWith("notification.")) {
        eventBus.publishToUser(command.user.id, {
          type: "notification.updated",
          data: { commandType: command.definition.type },
        });
      }
    } catch (error) {
      console.error(`Command ${command.definition.type} failed:`, error);

      // Create an error notification so the user gets feedback
      try {
        await createNotification({
          userId: command.user.id,
          type: "error",
          title: "Action failed",
          message: "Something went wrong. Please try again.",
        });
        eventBus.publishToUser(command.user.id, {
          type: "notification.updated",
          data: { commandType: command.definition.type },
        });
      } catch (notifyError) {
        console.error("Failed to create error notification:", notifyError);
      }
    } finally {
      this.processing = false;
    }
  }
}

export const commandStore = new CommandStore();
