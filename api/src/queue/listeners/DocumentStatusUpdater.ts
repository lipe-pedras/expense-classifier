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
    try {
      await this.documentRepo.updateStatus(event.documentId, 'DONE');
    } catch {
      // Document may have been deleted before status update (e.g., during test teardown)
    }
  }

  async onFailed(event: JobFailedEvent): Promise<void> {
    try {
      await this.documentRepo.updateStatus(event.documentId, 'FAILED');
    } catch {
      // Document may have been deleted before status update
    }
  }
}
