import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Queue } from 'bullmq';
import {
  JobQueueService,
  DOCUMENT_JOB_NAME,
  type DocumentJobPayload,
} from '../../../src/services/JobQueueService.js';

describe('JobQueueService', () => {
  let queue: Queue;
  let service: JobQueueService;

  beforeEach(() => {
    queue = { add: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
    service = new JobQueueService(queue);
  });

  describe('enqueue', () => {
    it('should enqueue the job with retries and the custom backoff strategy', async () => {
      const payload: DocumentJobPayload = {
        documentId: 'doc-1',
        filePath: '/uploads/a.pdf',
        fileType: 'PDF',
        userId: 'user-1',
        categories: [],
      };

      await service.enqueue(payload);

      expect(queue.add).toHaveBeenCalledWith(DOCUMENT_JOB_NAME, payload, {
        attempts: 3,
        backoff: { type: 'document-backoff' },
        removeOnComplete: true,
        removeOnFail: false,
      });
    });

    it('should propagate errors from the underlying queue', async () => {
      (queue.add as any).mockRejectedValue(new Error('redis down'));
      await expect(
        service.enqueue({
          documentId: 'd',
          filePath: 'p',
          fileType: 'IMAGE',
          userId: 'u',
          categories: [],
        }),
      ).rejects.toThrow('redis down');
    });
  });
});
