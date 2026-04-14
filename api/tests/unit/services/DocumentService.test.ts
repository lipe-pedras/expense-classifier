import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Category, Document, Expense } from '@prisma/client';
import { DocumentService } from '../../../src/services/DocumentService.js';
import type {
  ICategoryRepository,
  IDocumentRepository,
  IExpenseRepository,
} from '../../../src/repositories/interfaces/IRepository.js';
import type { StorageService } from '../../../src/services/StorageService.js';
import type { IJobQueueService } from '../../../src/services/JobQueueService.js';
import {
  CategoryNotFoundError,
  DocumentNotFoundError,
  DocumentTooLargeError,
  DocumentUnsupportedTypeError,
} from '../../../src/errors/AppError.js';

const fakeDocument: Document = {
  id: 'doc-1',
  userId: 'user-1',
  originalName: 'bill.pdf',
  filePath: '/uploads/abc.pdf',
  fileType: 'PDF',
  status: 'PENDING',
  expenseCount: 0,
  uploadedAt: new Date('2026-01-01T00:00:00Z'),
};

const fakeCategory: Category = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Rent',
  slug: 'rent',
  isSystem: true,
};

const fakeExpense: Expense = {
  id: 'exp-1',
  userId: 'user-1',
  documentId: 'doc-1',
  categoryId: 'cat-1',
  segmentIndex: 0,
  amount: 100,
  currency: 'USD',
  expenseDate: new Date('2026-01-01'),
  vendor: 'Acme',
  confidence: 0.9,
  rawText: 'raw',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function makeDocumentRepo(): IDocumentRepository {
  return {
    findById: vi.fn(),
    findByIdForUser: vi.fn(),
    findAllByUser: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    incrementExpenseCount: vi.fn(),
    delete: vi.fn(),
  };
}
function makeExpenseRepo(): IExpenseRepository {
  return {
    findById: vi.fn(),
    findByIdForUser: vi.fn(),
    findAllByUser: vi.fn(),
    findByDocument: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getCurrentMonthByCategory: vi.fn(),
    getHistoryByMonth: vi.fn(),
  };
}
function makeCategoryRepo(): ICategoryRepository {
  return {
    findById: vi.fn(),
    findByIdForUser: vi.fn(),
    findBySlugForUser: vi.fn(),
    findAllByUser: vi.fn(),
    create: vi.fn(),
    createManyForUser: vi.fn(),
    delete: vi.fn(),
  };
}

describe('DocumentService', () => {
  let documentRepo: IDocumentRepository;
  let expenseRepo: IExpenseRepository;
  let categoryRepo: ICategoryRepository;
  let storage: StorageService;
  let queue: IJobQueueService;
  let service: DocumentService;

  beforeEach(() => {
    documentRepo = makeDocumentRepo();
    expenseRepo = makeExpenseRepo();
    categoryRepo = makeCategoryRepo();
    storage = {
      saveUploadedFile: vi.fn().mockResolvedValue('/uploads/abc.pdf'),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;
    queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    service = new DocumentService(
      documentRepo,
      expenseRepo,
      categoryRepo,
      storage,
      queue,
      10 * 1024 * 1024,
    );
  });

  describe('upload', () => {
    it('should save the file, persist the document, and enqueue a job', async () => {
      (documentRepo.create as any).mockResolvedValue(fakeDocument);

      const result = await service.upload('user-1', {
        buffer: Buffer.from('x'),
        originalName: 'bill.pdf',
        mimeType: 'application/pdf',
      });

      expect(storage.saveUploadedFile).toHaveBeenCalled();
      expect(documentRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        originalName: 'bill.pdf',
        filePath: '/uploads/abc.pdf',
        fileType: 'PDF',
      });
      expect(queue.enqueue).toHaveBeenCalledWith({
        documentId: fakeDocument.id,
        filePath: fakeDocument.filePath,
        fileType: 'PDF',
        userId: 'user-1',
      });
      expect(result).toEqual(fakeDocument);
    });

    it('should map image/jpeg to IMAGE file type', async () => {
      (documentRepo.create as any).mockResolvedValue({ ...fakeDocument, fileType: 'IMAGE' });

      await service.upload('user-1', {
        buffer: Buffer.from('x'),
        originalName: 'bill.jpg',
        mimeType: 'image/jpeg',
      });

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ fileType: 'IMAGE' }),
      );
    });

    it('should throw DocumentUnsupportedTypeError for disallowed mime types', async () => {
      await expect(
        service.upload('user-1', {
          buffer: Buffer.from('x'),
          originalName: 'a.txt',
          mimeType: 'text/plain',
        }),
      ).rejects.toBeInstanceOf(DocumentUnsupportedTypeError);
      expect(storage.saveUploadedFile).not.toHaveBeenCalled();
    });

    it('should throw DocumentTooLargeError when the buffer exceeds the limit', async () => {
      const small = new DocumentService(
        documentRepo,
        expenseRepo,
        categoryRepo,
        storage,
        queue,
        4,
      );
      await expect(
        small.upload('user-1', {
          buffer: Buffer.from('12345'),
          originalName: 'a.pdf',
          mimeType: 'application/pdf',
        }),
      ).rejects.toBeInstanceOf(DocumentTooLargeError);
    });
  });

  describe('getById', () => {
    it('should return the document when it belongs to the user', async () => {
      (documentRepo.findByIdForUser as any).mockResolvedValue(fakeDocument);
      await expect(service.getById('user-1', 'doc-1')).resolves.toEqual(fakeDocument);
      expect(documentRepo.findByIdForUser).toHaveBeenCalledWith('doc-1', 'user-1');
    });

    it('should throw DocumentNotFoundError when the document belongs to another user', async () => {
      (documentRepo.findByIdForUser as any).mockResolvedValue(null);
      await expect(service.getById('user-2', 'doc-1')).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
    });
  });

  describe('delete', () => {
    it('should delete the document and best-effort remove the file', async () => {
      (documentRepo.findByIdForUser as any).mockResolvedValue(fakeDocument);
      await service.delete('user-1', 'doc-1');
      expect(documentRepo.delete).toHaveBeenCalledWith('doc-1');
      expect(storage.deleteFile).toHaveBeenCalledWith(fakeDocument.filePath);
    });

    it('should throw DocumentNotFoundError when the document is owned by another user', async () => {
      (documentRepo.findByIdForUser as any).mockResolvedValue(null);
      await expect(service.delete('user-2', 'doc-1')).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
      expect(documentRepo.delete).not.toHaveBeenCalled();
      expect(storage.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('recordInternalResult', () => {
    const input = {
      documentId: 'doc-1',
      segmentIndex: 0,
      categorySlug: 'rent',
      vendor: 'Acme',
      amount: 100,
      currency: 'USD',
      expenseDate: new Date('2026-01-01'),
      confidence: 0.9,
      rawText: 'raw text',
    };

    it('should create an expense and increment the document counter', async () => {
      (documentRepo.findById as any).mockResolvedValue(fakeDocument);
      (categoryRepo.findBySlugForUser as any).mockResolvedValue(fakeCategory);
      (expenseRepo.create as any).mockResolvedValue(fakeExpense);

      const result = await service.recordInternalResult(input);

      expect(categoryRepo.findBySlugForUser).toHaveBeenCalledWith('rent', 'user-1');
      expect(expenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          documentId: 'doc-1',
          categoryId: 'cat-1',
          rawText: 'raw text',
        }),
      );
      expect(documentRepo.incrementExpenseCount).toHaveBeenCalledWith('doc-1');
      expect(result).toEqual(fakeExpense);
    });

    it('should truncate rawText to 10,000 characters', async () => {
      (documentRepo.findById as any).mockResolvedValue(fakeDocument);
      (categoryRepo.findBySlugForUser as any).mockResolvedValue(fakeCategory);
      (expenseRepo.create as any).mockResolvedValue(fakeExpense);

      await service.recordInternalResult({ ...input, rawText: 'a'.repeat(15_000) });

      const arg = (expenseRepo.create as any).mock.calls[0][0];
      expect(arg.rawText.length).toBe(10_000);
    });

    it('should throw DocumentNotFoundError when the document is missing', async () => {
      (documentRepo.findById as any).mockResolvedValue(null);
      await expect(service.recordInternalResult(input)).rejects.toBeInstanceOf(
        DocumentNotFoundError,
      );
    });

    it('should throw CategoryNotFoundError when the category slug does not exist for the user', async () => {
      (documentRepo.findById as any).mockResolvedValue(fakeDocument);
      (categoryRepo.findBySlugForUser as any).mockResolvedValue(null);
      await expect(service.recordInternalResult(input)).rejects.toBeInstanceOf(
        CategoryNotFoundError,
      );
    });
  });
});
