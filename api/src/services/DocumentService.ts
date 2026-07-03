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

    const originalName = await this.uniqueDocumentName(userId, input.originalName);
    const document = await this.documentRepo.create({
      userId,
      originalName,
      filePath,
      fileType,
    });

    // Attach the user's categories so the worker classifies into the user's own
    // set rather than a hardcoded list.
    const categories = await this.categoryRepo.findAllByUser(userId);

    await this.queue.enqueue({
      documentId: document.id,
      filePath,
      fileType,
      userId,
      categories: categories.map((c) => ({ slug: c.slug, name: c.name })),
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

  async rename(userId: string, documentId: string, desiredName: string): Promise<Document> {
    const doc = await this.documentRepo.findByIdForUser(documentId, userId);
    if (!doc) throw new DocumentNotFoundError();
    const originalName = await this.uniqueDocumentName(userId, desiredName.trim(), documentId);
    return this.documentRepo.updateName(documentId, originalName);
  }

  async delete(userId: string, documentId: string): Promise<void> {
    const doc = await this.documentRepo.findByIdForUser(documentId, userId);
    if (!doc) throw new DocumentNotFoundError();
    await this.documentRepo.delete(documentId);
    await this.storage.deleteFile(doc.filePath);
  }

  /**
   * Returns a document name unique among the user's documents. If `desired` is
   * already taken, appends " (1)", " (2)", … before the file extension until a
   * free name is found. `excludeId` skips the document being renamed so it does
   * not collide with its own current name.
   */
  private async uniqueDocumentName(
    userId: string,
    desired: string,
    excludeId?: string,
  ): Promise<string> {
    const existing = await this.documentRepo.findAllByUser(userId);
    const taken = new Set(
      existing.filter((d) => d.id !== excludeId).map((d) => d.originalName),
    );
    if (!taken.has(desired)) return desired;

    // Split extension only when the dot is not the first character (so hidden
    // names like ".env" keep their leading dot as part of the base).
    const dot = desired.lastIndexOf('.');
    const base = dot > 0 ? desired.slice(0, dot) : desired;
    const ext = dot > 0 ? desired.slice(dot) : '';

    let n = 1;
    let candidate = `${base} (${n})${ext}`;
    while (taken.has(candidate)) {
      n += 1;
      candidate = `${base} (${n})${ext}`;
    }
    return candidate;
  }

  /**
   * Invoked by the internal route at the start of a job, before any results are
   * posted, to clear any expenses left over from a previous (possibly partial or
   * stalled-and-reprocessed) run of the same document. This makes the worker's
   * persistence step idempotent at the document level: re-running a job replaces
   * its expenses instead of duplicating them.
   */
  async resetDocumentResults(documentId: string): Promise<void> {
    const document = await this.documentRepo.findById(documentId);
    if (!document) throw new DocumentNotFoundError();
    await this.expenseRepo.deleteByDocumentId(documentId);
    await this.documentRepo.resetExpenseCount(documentId);
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
