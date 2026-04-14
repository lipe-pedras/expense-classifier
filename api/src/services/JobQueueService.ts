import type { Queue } from 'bullmq';
import type { FileType } from '@prisma/client';

export const DOCUMENT_QUEUE_NAME = 'document-processing';
export const DOCUMENT_JOB_NAME = 'process-document';

export interface DocumentJobPayload {
  documentId: string;
  filePath: string;
  fileType: FileType;
  userId: string;
}

export interface IJobQueueService {
  enqueue(payload: DocumentJobPayload): Promise<void>;
}

export class JobQueueService implements IJobQueueService {
  constructor(private readonly queue: Queue) {}

  async enqueue(payload: DocumentJobPayload): Promise<void> {
    // 3 attempts with a custom backoff strategy [1s, 5s, 30s] that the
    // Worker registers under the name 'document-backoff'.
    await this.queue.add(DOCUMENT_JOB_NAME, payload, {
      attempts: 3,
      backoff: { type: 'document-backoff' },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
