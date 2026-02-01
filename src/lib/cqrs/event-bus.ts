import { EventEmitter } from "events";

type EventHandler = (payload: unknown) => void;

// Simple event bus for pub/sub notifications
class EventBus {
  private emitter = new EventEmitter();

  // Subscribes to events on a channel
  subscribe(channel: string, handler: EventHandler): () => void {
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }

  // Publishes event to a channel
  publish(channel: string, payload: unknown): void {
    this.emitter.emit(channel, payload);
  }

  // Subscribes to user-scoped events
  subscribeToUser(userId: string, handler: EventHandler): () => void {
    return this.subscribe(`user:${userId}`, handler);
  }

  // Publishes event to a user's channel
  publishToUser(userId: string, payload: unknown): void {
    this.publish(`user:${userId}`, payload);
  }

  // Subscribes to session-scoped events
  subscribeToSession(sessionToken: string, handler: EventHandler): () => void {
    return this.subscribe(`session:${sessionToken}`, handler);
  }

  // Publishes event to a session's channel
  publishToSession(sessionToken: string, payload: unknown): void {
    this.publish(`session:${sessionToken}`, payload);
  }
}

export const eventBus = new EventBus();
