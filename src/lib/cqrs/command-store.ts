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

      // Emit event on success
      if (command.definition.emits) {
        eventBus.publishToUser(command.user.id, {
          type: command.definition.emits,
          data: result,
        });
      }
    } catch (error) {
      console.error(`Command ${command.definition.type} failed:`, error);
    } finally {
      this.processing = false;
    }
  }
}

export const commandStore = new CommandStore();
