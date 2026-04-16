import type { JobCompletedEvent } from '../events/JobCompletedEvent.js';
import type { JobFailedEvent } from '../events/JobFailedEvent.js';

export interface IWebSocket {
  send(data: string): void;
}

/**
 * Tracks authenticated WebSocket connections by userId and pushes real-time
 * status notifications when processing jobs complete or fail.
 */
export class WebSocketNotifier {
  private readonly connections = new Map<string, Set<IWebSocket>>();

  register(userId: string, socket: IWebSocket): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(socket);
  }

  unregister(userId: string, socket: IWebSocket): void {
    this.connections.get(userId)?.delete(socket);
  }

  async onCompleted(event: JobCompletedEvent): Promise<void> {
    this.sendToUser(event.userId, { type: 'job:completed', documentId: event.documentId });
  }

  async onFailed(event: JobFailedEvent): Promise<void> {
    this.sendToUser(event.userId, {
      type: 'job:failed',
      documentId: event.documentId,
      reason: event.reason,
    });
  }

  private sendToUser(userId: string, payload: object): void {
    const sockets = this.connections.get(userId);
    if (!sockets) return;
    const msg = JSON.stringify(payload);
    for (const socket of sockets) {
      try {
        socket.send(msg);
      } catch {
        // socket may have disconnected between check and send
      }
    }
  }
}
