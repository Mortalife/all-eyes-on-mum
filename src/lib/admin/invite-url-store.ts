type InviteResult = {
  userName: string;
  inviteUrl: string;
};

// In-memory store for the most recently generated invite URL per admin user.
// Used to surface the invite link in the admin UI after user creation.
class InviteUrlStore {
  private urls = new Map<string, InviteResult>();

  // Stores an invite URL for an admin user
  set(adminUserId: string, result: InviteResult): void {
    this.urls.set(adminUserId, result);
  }

  // Retrieves and clears the invite URL for an admin user (single read)
  consume(adminUserId: string): InviteResult | null {
    const result = this.urls.get(adminUserId) || null;
    this.urls.delete(adminUserId);
    return result;
  }
}

export const inviteUrlStore = new InviteUrlStore();
export type { InviteResult };
