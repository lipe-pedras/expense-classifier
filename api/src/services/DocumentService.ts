import type { Document, Expense, FileType } from '@prisma/client';
import type {
  IDocumentRepository,
  IExpenseRepository,
  ICategoryRepository,
} from '../repositories/interfaces/IRepository.js';
import type { StorageService } from './StorageService.js';
import type { IJobQueueService } from './JobQueueService.js';
import {
  DocumentNotFoundError,
  DocumentTooLargeError,
  DocumentUnsupportedTypeError,
  CategoryNotFoundError,
} from '../errors/AppError.js';
import { ACCEPTED_MIME_TYPES } from '../config.js';

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface InternalResultInput {
  documentId: string;
  segmentIndex: number;
  categorySlug: string;
  vendor: string | null;
  amount: number;
  currency: string;
  expenseDate: Date;
  confidence: number;
  rawText: string;
}

export class DocumentService {
  constructor(
    private readonly documentRepo: IDocumentRepository,
    private readonly expenseRepo: IExpenseRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly storage: StorageService,
    private readonly queue: IJobQueueService,
    private readonly maxFileSizeBytes: number,
  ) {}

  async upload(userId: string, input: UploadInput): Promise<Document> {
    if (!ACCEPTED_MIME_TYPES.includes(input.mimeType)) {
      throw new DocumentUnsupportedTypeError();
    }
    if (input.buffer.length > this.maxFileSizeBytes) {
      throw new DocumentTooLargeError();
    }

    const fileType: FileType = input.mimeType === 'application/pdf' ? 'PDF' : 'IMAGE';
    const filePath = await this.storage.saveUploadedFile(input.buffer, input.originalName);

    const document = await this.documentRepo.create({
      userId,
      originalName: input.originalName,
      filePath,
      fileType,
    });

    await this.queue.enqueue({
      documentId: document.id,
      filePath,
      fileType,
      userId,
    });

    return document;
  }

  list(userId: string): Promise<Document[]> {
    return this.documentRepo.findAllByUser(userId);
  }

  async getById(userId: string, documentId: string): Promise<Document> {
    const doc = await this.documentRepo.findByIdForUser(documentId, userId);
    if (!doc) throw new DocumentNotFoundError();
    return doc;
  }

  async delete(userId: string, documentId: string): Promise<void> {
    const doc = await this.documentRepo.findByIdForUser(documentId, userId);
    if (!doc) throw new DocumentNotFoundError();
    await this.documentRepo.delete(documentId);
    await this.storage.deleteFile(doc.filePath);
  }

  /**
   * Invoked by the internal service-token-protected route once the worker has
   * classified a segment. Persists the expense and bumps the document counter.
   */
  async recordInternalResult(input: InternalResultInput): Promise<Expense> {
    const document = await this.documentRepo.findById(input.documentId);
    if (!document) throw new DocumentNotFoundError();

    const category = await this.categoryRepo.findBySlugForUser(
      input.categorySlug,
      document.userId,
    );
    if (!category) throw new CategoryNotFoundError();

    const expense = await this.expenseRepo.create({
      userId: document.userId,
      documentId: document.id,
      categoryId: category.id,
      segmentIndex: input.segmentIndex,
      amount: input.amount,
      currency: input.currency,
      expenseDate: input.expenseDate,
      vendor: input.vendor,
      confidence: input.confidence,
      rawText: input.rawText.slice(0, 10_000),
    });
    await this.documentRepo.incrementExpenseCount(document.id);
    return expense;
  }
}
