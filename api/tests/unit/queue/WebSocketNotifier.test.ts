import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WebSocketNotifier,
  type IWebSocket,
} from '../../../src/queue/listeners/WebSocketNotifier.js';

function makeSocket(): IWebSocket {
  return { send: vi.fn() };
}

describe('WebSocketNotifier', () => {
  let notifier: WebSocketNotifier;

  beforeEach(() => {
    notifier = new WebSocketNotifier();
  });

  describe('register / unregister', () => {
    it('should send messages to registered sockets', async () => {
      const socket = makeSocket();
      notifier.register('user-1', socket);

      await notifier.onCompleted({ jobId: 'j1', documentId: 'doc-1', userId: 'user-1' });

      expect(socket.send).toHaveBeenCalledOnce();
      const msg = JSON.parse((socket.send as any).mock.calls[0][0]);
      expect(msg).toMatchObject({ type: 'job:completed', documentId: 'doc-1' });
    });

    it('should not send to sockets after they have been unregistered', async () => {
      const socket = makeSocket();
      notifier.register('user-1', socket);
      notifier.unregister('user-1', socket);

      await notifier.onCompleted({ jobId: 'j1', documentId: 'doc-1', userId: 'user-1' });

      expect(socket.send).not.toHaveBeenCalled();
    });

    it('should not send to sockets belonging to a different user', async () => {
      const socket = makeSocket();
      notifier.register('user-1', socket);

      await notifier.onCompleted({ jobId: 'j1', documentId: 'doc-1', userId: 'user-2' });

      expect(socket.send).not.toHaveBeenCalled();
    });

    it('should support multiple sockets per user', async () => {
      const s1 = makeSocket();
      const s2 = makeSocket();
      notifier.register('user-1', s1);
      notifier.register('user-1', s2);

      await notifier.onCompleted({ jobId: 'j1', documentId: 'doc-1', userId: 'user-1' });

      expect(s1.send).toHaveBeenCalledOnce();
      expect(s2.send).toHaveBeenCalledOnce();
    });
  });

  describe('onFailed', () => {
    it('should send a job:failed message with the failure reason', async () => {
      const socket = makeSocket();
      notifier.register('user-1', socket);

      await notifier.onFailed({
        jobId: 'j2',
        documentId: 'doc-2',
        userId: 'user-1',
        reason: 'OCR failed',
      });

      const msg = JSON.parse((socket.send as any).mock.calls[0][0]);
      expect(msg).toMatchObject({ type: 'job:failed', documentId: 'doc-2', reason: 'OCR failed' });
    });

    it('should not throw when the socket.send fails', async () => {
      const socket: IWebSocket = { send: vi.fn().mockImplementation(() => { throw new Error('broken'); }) };
      notifier.register('user-1', socket);

      await expect(
        notifier.onFailed({ jobId: 'j2', documentId: 'doc-2', userId: 'user-1', reason: 'x' }),
      ).resolves.toBeUndefined();
    });
  });
});
