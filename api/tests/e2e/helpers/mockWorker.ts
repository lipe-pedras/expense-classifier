import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import type { DocumentJobPayload } from '../../../src/services/JobQueueService.js';

/**
 * Runs inside the test process and simulates the Python worker.
 * When a job lands in the queue, it calls /internal/results via app.inject()
 * with fake-but-valid data, then marks the job complete.
 */
export class MockWorker {
  private readonly worker: Worker;
  private readonly redis: Redis;

  constructor(redisUrl: string, queueName: string, app: FastifyInstance, internalToken: string) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

    this.worker = new Worker(
      queueName,
      async (job) => {
        const { documentId, userId } = job.data as DocumentJobPayload;

        await app.inject({
          method: 'POST',
          url: '/internal/results',
          headers: { Authorization: `Bearer ${internalToken}` },
          payload: {
            documentId,
            segmentIndex: 0,
            categorySlug: 'other',
            vendor: 'Mock Vendor',
            amount: 42.0,
            currency: 'BRL',
            expenseDate: new Date().toISOString(),
            confidence: 0.99,
            rawText: 'Mock processed expense text',
          },
        });

        return { documentId, userId };
      },
      { connection: this.redis },
    );

    this.worker.on('error', () => {
      // suppress worker errors during tests
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.redis.quit();
  }
}
