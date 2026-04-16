import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../src/queue/EventBus.js';
import type { IEventListener } from '../../../src/queue/interfaces/IEventListener.js';
import type { JobCompletedEvent } from '../../../src/queue/events/JobCompletedEvent.js';
import type { JobFailedEvent } from '../../../src/queue/events/JobFailedEvent.js';

const completedEvent: JobCompletedEvent = {
  jobId: 'j1',
  documentId: 'doc-1',
  userId: 'user-1',
};

const failedEvent: JobFailedEvent = {
  jobId: 'j2',
  documentId: 'doc-2',
  userId: 'user-1',
  reason: 'OCR crashed',
};

describe('EventBus', () => {
  describe('emit', () => {
    it('should call every registered listener for the event', async () => {
      const bus = new EventBus();
      const listener1: IEventListener<JobCompletedEvent> = { handle: vi.fn() };
      const listener2: IEventListener<JobCompletedEvent> = { handle: vi.fn() };

      bus.on('job:completed', listener1);
      bus.on('job:completed', listener2);

      await bus.emit('job:completed', completedEvent);

      expect(listener1.handle).toHaveBeenCalledWith(completedEvent);
      expect(listener2.handle).toHaveBeenCalledWith(completedEvent);
    });

    it('should not call listeners registered for a different event', async () => {
      const bus = new EventBus();
      const failedListener: IEventListener<JobFailedEvent> = { handle: vi.fn() };

      bus.on('job:failed', failedListener);

      await bus.emit('job:completed', completedEvent);

      expect(failedListener.handle).not.toHaveBeenCalled();
    });

    it('should emit with no listeners without throwing', async () => {
      const bus = new EventBus();
      await expect(bus.emit('job:completed', completedEvent)).resolves.toBeUndefined();
    });

    it('should await async listeners before resolving', async () => {
      const bus = new EventBus();
      const order: number[] = [];
      const slow: IEventListener<JobCompletedEvent> = {
        handle: async () => {
          await new Promise((r) => setTimeout(r, 10));
          order.push(1);
        },
      };
      const fast: IEventListener<JobCompletedEvent> = {
        handle: async () => { order.push(2); },
      };

      bus.on('job:completed', slow);
      bus.on('job:completed', fast);

      await bus.emit('job:completed', completedEvent);

      expect(order).toContain(1);
      expect(order).toContain(2);
    });

    it('should deliver job:failed events correctly', async () => {
      const bus = new EventBus();
      const listener: IEventListener<JobFailedEvent> = { handle: vi.fn() };

      bus.on('job:failed', listener);
      await bus.emit('job:failed', failedEvent);

      expect(listener.handle).toHaveBeenCalledWith(failedEvent);
    });
  });
});
