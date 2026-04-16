import type { IEventListener } from './interfaces/IEventListener.js';
import type { JobCompletedEvent } from './events/JobCompletedEvent.js';
import type { JobFailedEvent } from './events/JobFailedEvent.js';

export interface EventMap {
  'job:completed': JobCompletedEvent;
  'job:failed': JobFailedEvent;
}

export class EventBus {
  private readonly listeners = new Map<string, IEventListener<unknown>[]>();

  on<K extends keyof EventMap>(event: K, listener: IEventListener<EventMap[K]>): void {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, listener as IEventListener<unknown>]);
  }

  async emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<void> {
    const handlers = this.listeners.get(event) ?? [];
    await Promise.all(handlers.map((h) => h.handle(payload)));
  }
}
