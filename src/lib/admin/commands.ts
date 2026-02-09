import { createUser, emailExists } from "../../lib/auth/index.ts";
import { defineCommand } from "../cqrs/index.ts";
import { createNotification } from "../notifications/index.ts";

// Creates a new family member user account
export const createUserCommand = defineCommand({
  type: "admin.createUser",
  emits: "admin.userCreated",
  handler: async (
    user,
    data: { email: string; password: string; name: string },
  ) => {
    if (await emailExists(data.email)) {
      throw new Error("An account with this email already exists");
    }

    const newUser = await createUser(data.email, data.password, data.name);

    await createNotification({
      userId: user.id,
      type: "success",
      title: "User created",
      message: `${data.name} has been added as a family member.`,
    });

    return { success: true, user: newUser };
  },
});
