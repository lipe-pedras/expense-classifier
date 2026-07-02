import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { promises as fs } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { UserRepository } from '../../../src/repositories/UserRepository.js';
import { DocumentRepository } from '../../../src/repositories/DocumentRepository.js';
import { ExpenseRepository } from '../../../src/repositories/ExpenseRepository.js';
import { CategoryRepository } from '../../../src/repositories/CategoryRepository.js';
import { JwtService } from '../../../src/services/JwtService.js';
import { AuthService, BcryptHasher } from '../../../src/services/AuthService.js';
import { UserService } from '../../../src/services/UserService.js';
import { CategoryService } from '../../../src/services/CategoryService.js';
import { StorageService } from '../../../src/services/StorageService.js';
import { JobQueueService } from '../../../src/services/JobQueueService.js';

// Use a dedicated test queue name so e2e tests never obliterate the production queue.
const E2E_QUEUE_NAME = 'document-processing-e2e';
import { DocumentService } from '../../../src/services/DocumentService.js';
import { EventBus } from '../../../src/queue/EventBus.js';
import { DocumentStatusUpdater } from '../../../src/queue/listeners/DocumentStatusUpdater.js';
import { ExpenseService } from '../../../src/services/ExpenseService.js';
import { ExportService } from '../../../src/services/ExportService.js';
import { WebSocketNotifier } from '../../../src/queue/listeners/WebSocketNotifier.js';
import { testPrisma, resetDatabase } from '../../helpers/dbClient.js';
import { MockWorker } from './mockWorker.js';

export const E2E_INTERNAL_TOKEN = 'e2e_internal_token';
export const E2E_UPLOAD_PATH = '/tmp/e2e_uploads';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';

export interface ExchangeLog {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseStatus: number;
  responseBody: unknown;
  durationMs: number;
  error?: string;
}

export interface E2eApp {
  app: FastifyInstance;
  mockWorker: MockWorker;
  redis: Redis;
  queueEvents: QueueEvents;
  /** Drain the BullMQ queue then reset the test database. Call this in beforeEach. */
  resetBetweenTests: () => Promise<void>;
  getExchangeLogs: () => ExchangeLog[];
  clearExchangeLogs: () => void;
}

export async function buildE2eApp(): Promise<E2eApp> {
  // Disable Swagger in e2e tests to avoid overhead
  process.env.SWAGGER_ENABLED = 'false';

  await fs.mkdir(E2E_UPLOAD_PATH, { recursive: true });

  // Repositories backed by the real test database
  const userRepo = new UserRepository(testPrisma);
  const documentRepo = new DocumentRepository(testPrisma);
  const expenseRepo = new ExpenseRepository(testPrisma);
  const categoryRepo = new CategoryRepository(testPrisma);

  // Services — real implementations, fast bcrypt rounds for test speed
  const jwtService = new JwtService('e2e_access_secret', 'e2e_refresh_secret', 900, 604800);
  const hasher = new BcryptHasher(4);
  const storage = new StorageService(E2E_UPLOAD_PATH, fs);

  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue(E2E_QUEUE_NAME, { connection: redis });

  // Remove ALL stale jobs from previous test runs before the worker starts listening.
  // Without this, the worker picks up leftover jobs and blocks the current test's job.
  await queue.obliterate({ force: true });

  const queueEvents = new QueueEvents(E2E_QUEUE_NAME, { connection: redis.duplicate() });
  const jobQueue = new JobQueueService(queue);

  // Wire up DocumentStatusUpdater so document status transitions PENDING → DONE
  const eventBus = new EventBus();
  const statusUpdater = new DocumentStatusUpdater(documentRepo);
  eventBus.on('job:completed', { handle: (e) => statusUpdater.onCompleted(e) });
  eventBus.on('job:failed', { handle: (e) => statusUpdater.onFailed(e) });

  queueEvents.on('completed', async ({ jobId, returnvalue }) => {
    let data: { documentId?: string; userId?: string } | undefined;
    if (typeof returnvalue === 'string') {
      try { data = JSON.parse(returnvalue); } catch { /* malformed */ }
    } else {
      data = returnvalue as typeof data;
    }
    if (data?.documentId && data?.userId) {
      await eventBus.emit('job:completed', { jobId, documentId: data.documentId, userId: data.userId });
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
      // job already removed
    }
  });

  const authService = new AuthService(userRepo, jwtService, hasher);
  const userService = new UserService(userRepo, hasher);
  const categoryService = new CategoryService(categoryRepo);
  const documentService = new DocumentService(
    documentRepo,
    expenseRepo,
    categoryRepo,
    storage,
    jobQueue,
    10 * 1024 * 1024, // 10 MB limit in tests
  );
  const expenseService = new ExpenseService(expenseRepo, categoryRepo);
  const exportService = new ExportService(expenseRepo, categoryRepo, documentRepo);
  const wsNotifier = new WebSocketNotifier();

  const app = await buildApp({
    authService,
    userService,
    categoryService,
    documentService,
    expenseService,
    exportService,
    jwtService,
    wsNotifier,
    internalServiceToken: E2E_INTERNAL_TOKEN,
    maxFileSizeBytes: 10 * 1024 * 1024,
  });

  // Exchange log — captures every HTTP request/response for failure debugging
  const logs: ExchangeLog[] = [];
  const startTimes = new Map<string, number>();

  app.addHook('onRequest', async (req) => {
    startTimes.set(req.id, Date.now());
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k] = k.toLowerCase() === 'authorization' ? 'Bearer [REDACTED]' : String(v ?? '');
    }
    logs.push({
      method: req.method,
      url: req.url,
      requestHeaders: headers,
      requestBody: undefined,
      responseStatus: 0,
      responseBody: undefined,
      durationMs: 0,
    });
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const entry = logs.findLast((l) => l.url === req.url && l.method === req.method && l.responseStatus === 0);
    if (entry) {
      entry.responseStatus = reply.statusCode;
      entry.durationMs = Date.now() - (startTimes.get(req.id) ?? Date.now());
      try {
        entry.responseBody = typeof payload === 'string' ? JSON.parse(payload) : payload;
      } catch {
        entry.responseBody = payload;
      }
    }
    return payload;
  });

  app.addHook('onError', async (req, _reply, error) => {
    const entry = logs.findLast((l) => l.url === req.url && l.method === req.method && l.responseStatus === 0);
    if (entry) {
      entry.error = `${error.name}: ${error.message}`;
    }
  });

  const mockWorker = new MockWorker(REDIS_URL, E2E_QUEUE_NAME, app, E2E_INTERNAL_TOKEN);

  return {
    app,
    mockWorker,
    redis,
    queueEvents,
    resetBetweenTests: async () => {
      // Drain waiting jobs before resetting the DB to avoid FK violations from stale jobs.
      // obliterate is intentionally avoided here — killing an ACTIVE job mid-flight breaks
      // the BullMQ Worker's lock and causes it to stop processing new jobs.
      await queue.drain(true);
      await resetDatabase();
    },
    getExchangeLogs: () => [...logs],
    clearExchangeLogs: () => {
      logs.length = 0;
      startTimes.clear();
    },
  };
}
