import type { User } from "../../types/user.js";

// Defines the shape of a command
export type CommandDefinition<TData, TResult> = {
  type: string;
  emits: string;
  handler: (user: User, data: TData) => Promise<TResult>;
};

// Creates a typed command definition
export const defineCommand = <TData, TResult>(
  definition: CommandDefinition<TData, TResult>,
): CommandDefinition<TData, TResult> => definition;
