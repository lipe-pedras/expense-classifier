import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { buildApp } from './app.js';
import { config } from './config.js';
import { UserRepository } from './repositories/UserRepository.js';
import { DocumentRepository } from './repositories/DocumentRepository.js';
import { ExpenseRepository } from './repositories/ExpenseRepository.js';
import { CategoryRepository } from './repositories/CategoryRepository.js';
import { JwtService } from './services/JwtService.js';
import { AuthService, BcryptHasher } from './services/AuthService.js';
import { UserService } from './services/UserService.js';
import { CategoryService } from './services/CategoryService.js';
import { StorageService } from './services/StorageService.js';
import { JobQueueService, DOCUMENT_QUEUE_NAME } from './services/JobQueueService.js';
import { DocumentService } from './services/DocumentService.js';
import { ExpenseService } from './services/ExpenseService.js';
import { ExportService } from './services/ExportService.js';
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

  // Redis + BullMQ
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(DOCUMENT_QUEUE_NAME, { connection: redis });
  const queueEvents = new QueueEvents(DOCUMENT_QUEUE_NAME, { connection: redis.duplicate() });

  // Services
  const jwtService = new JwtService(
    config.jwtSecret,
    config.jwtRefreshSecret,
    config.accessTokenTtlSeconds,
    config.refreshTokenTtlSeconds,
  );
  const hasher = new BcryptHasher();
  const storage = new StorageService(config.fileUploadPath, fs);
  const jobQueue = new JobQueueService(queue);

  const authService = new AuthService(userRepo, jwtService, hasher);
  const userService = new UserService(userRepo);
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

  // Event bus wiring
  const eventBus = new EventBus();
  const statusUpdater = new DocumentStatusUpdater(documentRepo);
  const wsNotifier = new WebSocketNotifier();

  eventBus.on('job:completed', { handle: (e) => statusUpdater.onCompleted(e) });
  eventBus.on('job:failed', { handle: (e) => statusUpdater.onFailed(e) });
  eventBus.on('job:completed', { handle: (e) => wsNotifier.onCompleted(e) });
  eventBus.on('job:failed', { handle: (e) => wsNotifier.onFailed(e) });

  // BullMQ event subscriptions — the Python worker returns { documentId, userId }
  queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    try {
      const data = JSON.parse(returnvalue ?? '{}') as { documentId?: string; userId?: string };
      if (data.documentId && data.userId) {
        await eventBus.emit('job:completed', {
          jobId,
          documentId: data.documentId,
          userId: data.userId,
        });
      }
    } catch {
      // Malformed return value — nothing to update
    }
  });

  queueEvents.on('failed', async ({ jobId, failedReason }) => {
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

  const app = await buildApp({
    authService,
    userService,
    categoryService,
    documentService,
    expenseService,
    exportService,
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
