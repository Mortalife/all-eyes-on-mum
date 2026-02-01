import type { User } from "./user.js";

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
