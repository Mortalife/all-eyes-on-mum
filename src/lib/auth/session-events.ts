import { EventEmitter } from "node:events";

const events = new EventEmitter();
events.setMaxListeners(0);

export const watchSessionRevocation = (
  sessionId: string,
  userId: string,
  close: () => void,
) => {
  events.on(`session:${sessionId}`, close);
  events.on(`user:${userId}`, close);
  return () => {
    events.off(`session:${sessionId}`, close);
    events.off(`user:${userId}`, close);
  };
};
export const notifySessionRevoked = (id: string) => {
  events.emit(`session:${id}`);
};
export const notifyUserSessionsRevoked = (id: string) => {
  events.emit(`user:${id}`);
};
