import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { config } from './config.js';
import { UserRepository } from './repositories/UserRepository.js';
import { DocumentRepository } from './repositories/DocumentRepository.js';
import { ExpenseRepository } from './repositories/ExpenseRepository.js';
import { CategoryRepository } from './repositories/CategoryRepository.js';
import { ChartRepository } from './repositories/ChartRepository.js';
import { JwtService } from './services/JwtService.js';
import { AuthService, BcryptHasher } from './services/AuthService.js';
import { UserService } from './services/UserService.js';
import { CategoryService } from './services/CategoryService.js';
import { StorageService } from './services/StorageService.js';
import {
  JobQueueService,
  DOCUMENT_QUEUE_NAME,
  CLASSIFICATION_QUEUE_NAME,
  CHART_QUEUE_NAME,
} from './services/JobQueueService.js';
import { DocumentService } from './services/DocumentService.js';
import { ExpenseService } from './services/ExpenseService.js';
import { ExportService } from './services/ExportService.js';
import { ChartService } from './services/ChartService.js';
import { EventBus } from './queue/EventBus.js';
import { DocumentStatusUpdater } from './queue/listeners/DocumentStatusUpdater.js';
import { WebSocketNotifier } from './queue/listeners/WebSocketNotifier.js';
import { promises as fs } from 'node:fs';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  // Repositories
  const userRepo = new UserRepository(prisma);
  const documentRepo = new DocumentRepository(prisma);
  const expenseRepo = new ExpenseRepository(prisma);
  const categoryRepo = new CategoryRepository(prisma);
  const chartRepo = new ChartRepository(prisma);

  // Redis + BullMQ. The pipeline spans two queues: the extractor consumes
  // `document-processing`, then hands off to the llm-worker on `classification`.
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const documentQueue = new Queue(DOCUMENT_QUEUE_NAME, { connection: redis });
  const classificationQueue = new Queue(CLASSIFICATION_QUEUE_NAME, { connection: redis });
  const chartQueue = new Queue(CHART_QUEUE_NAME, { connection: redis });
  const documentQueueEvents = new QueueEvents(DOCUMENT_QUEUE_NAME, { connection: redis.duplicate() });
  const classificationQueueEvents = new QueueEvents(CLASSIFICATION_QUEUE_NAME, {
    connection: redis.duplicate(),
  });
  const chartQueueEvents = new QueueEvents(CHART_QUEUE_NAME, { connection: redis.duplicate() });

  // Services
  const jwtService = new JwtService(
    config.jwtSecret,
    config.jwtRefreshSecret,
    config.accessTokenTtlSeconds,
    config.refreshTokenTtlSeconds,
  );
  const hasher = new BcryptHasher();
  const storage = new StorageService(config.fileUploadPath, fs);
  const jobQueue = new JobQueueService(documentQueue);

  const authService = new AuthService(userRepo, jwtService, hasher);
  const userService = new UserService(userRepo, hasher);
  const categoryService = new CategoryService(categoryRepo);
  const documentService = new DocumentService(
    documentRepo,
    expenseRepo,
    categoryRepo,
    storage,
    jobQueue,
    config.maxFileSizeBytes,
  );
  const expenseService = new ExpenseService(expenseRepo, categoryRepo);
  const exportService = new ExportService(expenseRepo, categoryRepo, documentRepo);
  const chartService = new ChartService(chartQueue, chartQueueEvents, chartRepo);

  // Event bus wiring
  const eventBus = new EventBus();
  const statusUpdater = new DocumentStatusUpdater(documentRepo);
  const wsNotifier = new WebSocketNotifier();

  eventBus.on('job:completed', { handle: (e) => statusUpdater.onCompleted(e) });
  eventBus.on('job:failed', { handle: (e) => statusUpdater.onFailed(e) });
  eventBus.on('job:completed', { handle: (e) => wsNotifier.onCompleted(e) });
  eventBus.on('job:failed', { handle: (e) => wsNotifier.onFailed(e) });

  // A document is DONE only when the terminal classification stage completes.
  // The Python worker returns json.dumps({documentId, userId}); Node.js workers
  // in BullMQ v5 return already-parsed objects, so handle both shapes.
  classificationQueueEvents.on('completed', async ({ jobId, returnvalue }) => {
    let data: { documentId?: string; userId?: string } | undefined;
    if (typeof returnvalue === 'string') {
      try { data = JSON.parse(returnvalue); } catch { /* malformed */ }
    } else {
      data = returnvalue as typeof data;
    }
    if (data?.documentId && data?.userId) {
      await eventBus.emit('job:completed', {
        jobId,
        documentId: data.documentId,
        userId: data.userId,
      });
    }
  });

  // A failure in EITHER stage (extraction or classification) fails the document.
  const wireFailure = (events: QueueEvents, queue: Queue) => {
    events.on('failed', async ({ jobId, failedReason }) => {
      try {
        const job = await queue.getJob(jobId);
        if (job?.data.documentId && job?.data.userId) {
          await eventBus.emit('job:failed', {
            jobId,
            documentId: job.data.documentId,
            userId: job.data.userId,
            reason: failedReason,
          });
        }
      } catch {
        // Job already removed or unknown
      }
    });
  };
  wireFailure(documentQueueEvents, documentQueue);
  wireFailure(classificationQueueEvents, classificationQueue);

  const app = await buildApp({
    authService,
    userService,
    categoryService,
    documentService,
    expenseService,
    exportService,
    chartService,
    jwtService,
    wsNotifier,
    internalServiceToken: config.internalServiceToken,
    maxFileSizeBytes: config.maxFileSizeBytes,
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
