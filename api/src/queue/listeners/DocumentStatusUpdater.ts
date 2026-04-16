import type { IDocumentRepository } from '../../repositories/interfaces/IRepository.js';
import type { JobCompletedEvent } from '../events/JobCompletedEvent.js';
import type { JobFailedEvent } from '../events/JobFailedEvent.js';

/**
 * Listens to job completion/failure events and updates the document's
 * processing status accordingly.
 */
export class DocumentStatusUpdater {
  constructor(private readonly documentRepo: IDocumentRepository) {}

  async onCompleted(event: JobCompletedEvent): Promise<void> {
    await this.documentRepo.updateStatus(event.documentId, 'COMPLETED');
  }

  async onFailed(event: JobFailedEvent): Promise<void> {
    await this.documentRepo.updateStatus(event.documentId, 'FAILED');
  }
}
