import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentStatusUpdater } from '../../../src/queue/listeners/DocumentStatusUpdater.js';
import type { IDocumentRepository } from '../../../src/repositories/interfaces/IRepository.js';

function makeRepo(): IDocumentRepository {
  return {
    findById: vi.fn(),
    findByIdForUser: vi.fn(),
    findAllByUser: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    incrementExpenseCount: vi.fn(),
    delete: vi.fn(),
  };
}

describe('DocumentStatusUpdater', () => {
  let repo: IDocumentRepository;
  let updater: DocumentStatusUpdater;

  beforeEach(() => {
    repo = makeRepo();
    updater = new DocumentStatusUpdater(repo);
  });

  describe('onCompleted', () => {
    it('should set the document status to COMPLETED', async () => {
      await updater.onCompleted({ jobId: 'j1', documentId: 'doc-1', userId: 'user-1' });
      expect(repo.updateStatus).toHaveBeenCalledWith('doc-1', 'COMPLETED');
    });
  });

  describe('onFailed', () => {
    it('should set the document status to FAILED', async () => {
      await updater.onFailed({
        jobId: 'j2',
        documentId: 'doc-2',
        userId: 'user-1',
        reason: 'timeout',
      });
      expect(repo.updateStatus).toHaveBeenCalledWith('doc-2', 'FAILED');
    });
  });
});
