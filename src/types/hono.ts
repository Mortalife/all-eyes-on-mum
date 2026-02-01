import type { User } from "./user.ts";

export type Session = {
  token: string;
  userId: string;
  expiresAt: string;
};

export type HonoContext = {
  Variables: {
    user: User | null;
    session: Session | null;
  };
};
