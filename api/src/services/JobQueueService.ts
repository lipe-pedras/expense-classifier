import type { Queue } from 'bullmq';
import type { FileType } from '@prisma/client';

export const DOCUMENT_QUEUE_NAME = 'document-processing';
export const DOCUMENT_JOB_NAME = 'process-document';

// The extractor hands preprocessed segments off to the llm-worker on this
// queue; its completion is what marks a document DONE.
export const CLASSIFICATION_QUEUE_NAME = 'classification';

export interface JobCategory {
  slug: string;
  name: string;
}

export interface DocumentJobPayload {
  documentId: string;
  filePath: string;
  fileType: FileType;
  userId: string;
  /** The user's categories, so the worker classifies into the user's own set. */
  categories: JobCategory[];
}

export interface IJobQueueService {
  enqueue(payload: DocumentJobPayload): Promise<void>;
}

export class JobQueueService implements IJobQueueService {
  constructor(private readonly queue: Queue) {}

  async enqueue(payload: DocumentJobPayload): Promise<void> {
    // Retry failed jobs up to 3 times with exponential backoff starting at 1s.
    await this.queue.add(DOCUMENT_JOB_NAME, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
