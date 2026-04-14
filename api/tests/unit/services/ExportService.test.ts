import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as XLSX from 'xlsx';
import type { Category, Document, Expense } from '@prisma/client';
import { ExportService } from '../../../src/services/ExportService.js';
import type {
  ICategoryRepository,
  IDocumentRepository,
  IExpenseRepository,
} from '../../../src/repositories/interfaces/IRepository.js';

const category: Category = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Rent',
  slug: 'rent',
  isSystem: true,
};

const document: Document = {
  id: 'doc-1',
  userId: 'user-1',
  originalName: 'bill.pdf',
  filePath: '/uploads/a.pdf',
  fileType: 'PDF',
  status: 'COMPLETED',
  expenseCount: 1,
  uploadedAt: new Date('2026-01-01T00:00:00Z'),
};

const expense: Expense = {
  id: 'exp-1',
  userId: 'user-1',
  documentId: 'doc-1',
  categoryId: 'cat-1',
  segmentIndex: 0,
  amount: 1234.5,
  currency: 'USD',
  expenseDate: new Date('2026-01-15T12:00:00Z'),
  vendor: 'Acme',
  confidence: 0.87,
  rawText: 'raw',
  createdAt: new Date('2026-01-15T12:00:00Z'),
};

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

function parseBuffer(buf: Buffer) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
}

describe('ExportService', () => {
  let expenseRepo: IExpenseRepository;
  let categoryRepo: ICategoryRepository;
  let documentRepo: IDocumentRepository;
  let service: ExportService;

  beforeEach(() => {
    expenseRepo = makeExpenseRepo();
    categoryRepo = makeCategoryRepo();
    documentRepo = makeDocumentRepo();
    service = new ExportService(expenseRepo, categoryRepo, documentRepo);
  });

  it('should return an empty workbook buffer when there are no expenses', async () => {
    (expenseRepo.findAllByUser as any).mockResolvedValue([]);

    const buffer = await service.exportExpenses('user-1');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(categoryRepo.findAllByUser).not.toHaveBeenCalled();
    expect(documentRepo.findAllByUser).not.toHaveBeenCalled();
    expect(parseBuffer(buffer)).toEqual([]);
  });

  it('should include one row per expense with joined category and document names', async () => {
    (expenseRepo.findAllByUser as any).mockResolvedValue([expense]);
    (categoryRepo.findAllByUser as any).mockResolvedValue([category]);
    (documentRepo.findAllByUser as any).mockResolvedValue([document]);

    const buffer = await service.exportExpenses('user-1', { categorySlug: 'rent' });
    const rows = parseBuffer(buffer);

    expect(expenseRepo.findAllByUser).toHaveBeenCalledWith('user-1', { categorySlug: 'rent' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Date: '2026-01-15',
      Vendor: 'Acme',
      Category: 'Rent',
      Amount: 1234.5,
      Confidence: 0.87,
      Document: 'bill.pdf',
    });
  });

  it('should emit blank cells when joined category or document is missing', async () => {
    (expenseRepo.findAllByUser as any).mockResolvedValue([
      { ...expense, vendor: null, categoryId: 'missing', documentId: 'missing' },
    ]);
    (categoryRepo.findAllByUser as any).mockResolvedValue([]);
    (documentRepo.findAllByUser as any).mockResolvedValue([]);

    const rows = parseBuffer(await service.exportExpenses('user-1'));
    expect(rows).toHaveLength(1);
    expect(rows[0].Date).toBe('2026-01-15');
    expect(rows[0].Amount).toBe(1234.5);
  });
});
