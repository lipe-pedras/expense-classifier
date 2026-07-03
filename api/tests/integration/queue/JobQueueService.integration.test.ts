import { describe, it, expect, afterAll } from 'vitest';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { JobQueueService, DOCUMENT_QUEUE_NAME, DOCUMENT_JOB_NAME } from '../../../src/services/JobQueueService.js';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

describe('JobQueueService (integration)', () => {
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(DOCUMENT_QUEUE_NAME, { connection: redis });
  const service = new JobQueueService(queue);

  afterAll(async () => {
    await queue.obliterate({ force: true }).catch(() => {});
    await queue.close();
    await redis.quit();
  });

  it('should enqueue a job with the correct name, payload, and options', async () => {
    const payload = {
      documentId: 'doc-integration',
      filePath: '/uploads/test.pdf',
      fileType: 'PDF' as const,
      userId: 'user-integration',
      categories: [],
    };

    await service.enqueue(payload);

    const jobs = await queue.getJobs(['waiting', 'active', 'delayed']);
    const job = jobs.find((j) => j.data.documentId === 'doc-integration');

    expect(job).toBeDefined();
    expect(job!.name).toBe(DOCUMENT_JOB_NAME);
    expect(job!.data).toEqual(payload);
    expect(job!.opts.attempts).toBe(3);
    expect(job!.opts.removeOnComplete).toBe(true);
    expect(job!.opts.removeOnFail).toBe(false);
  });
});
