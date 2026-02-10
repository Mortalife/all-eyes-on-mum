import { createUser, emailExists } from "../../lib/auth/index.ts";
import { createRegistrationToken } from "../../lib/auth/registration-token.ts";
import { env } from "../../env.ts";
import { defineCommand } from "../cqrs/index.ts";
import { createNotification } from "../notifications/index.ts";
import { inviteUrlStore } from "./invite-url-store.ts";

// Creates a new family member user account without a password.
// Generates a registration token so the user can set their own password.
export const createUserCommand = defineCommand({
  type: "admin.createUser",
  emits: "admin.userCreated",
  handler: async (user, data: { email: string; name: string }) => {
    if (await emailExists(data.email)) {
      throw new Error("An account with this email already exists");
    }

    const newUser = await createUser(data.email, null, data.name);
    const token = await createRegistrationToken(newUser.id);
    const inviteUrl = `${env.BASE_URL}/auth/register/${token}`;

    // Store invite URL so the admin UI can display it
    inviteUrlStore.set(user.id, { userName: data.name, inviteUrl });

    await createNotification({
      userId: user.id,
      type: "success",
      title: "User created",
      message: `${data.name} has been added as a family member.`,
    });

    return { success: true, user: newUser, inviteUrl };
  },
});

// Regenerates an invite link for a user who hasn't set their password yet
export const regenerateInviteCommand = defineCommand({
  type: "admin.regenerateInvite",
  emits: "admin.inviteRegenerated",
  handler: async (user, data: { userId: string; userName: string }) => {
    const token = await createRegistrationToken(data.userId);
    const inviteUrl = `${env.BASE_URL}/auth/register/${token}`;

    inviteUrlStore.set(user.id, { userName: data.userName, inviteUrl });

    await createNotification({
      userId: user.id,
      type: "info",
      title: "Invite link regenerated",
      message: `A new invite link has been generated for ${data.userName}.`,
    });

    return { success: true, inviteUrl };
  },
});
