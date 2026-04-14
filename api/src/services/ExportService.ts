import * as XLSX from 'xlsx';
import type { Expense, Category, Document } from '@prisma/client';
import type {
  IExpenseRepository,
  ICategoryRepository,
  IDocumentRepository,
} from '../repositories/interfaces/IRepository.js';
import type { ExpenseFilters } from '../types/index.js';

interface ExpenseRow {
  Date: string;
  Vendor: string;
  Category: string;
  Amount: number;
  Confidence: number;
  Document: string;
}

export class ExportService {
  constructor(
    private readonly expenseRepo: IExpenseRepository,
    private readonly categoryRepo: ICategoryRepository,
    private readonly documentRepo: IDocumentRepository,
  ) {}

  async exportExpenses(userId: string, filters: ExpenseFilters = {}): Promise<Buffer> {
    const expenses = await this.expenseRepo.findAllByUser(userId, filters);

    if (expenses.length === 0) {
      return this.toBuffer([]);
    }

    const [categories, documents] = await Promise.all([
      this.categoryRepo.findAllByUser(userId),
      this.documentRepo.findAllByUser(userId),
    ]);

    const rows = expenses.map((e) => this.toRow(e, categories, documents));
    return this.toBuffer(rows);
  }

  private toRow(
    expense: Expense,
    categories: Category[],
    documents: Document[],
  ): ExpenseRow {
    const category = categories.find((c) => c.id === expense.categoryId);
    const document = documents.find((d) => d.id === expense.documentId);
    return {
      Date: expense.expenseDate.toISOString().slice(0, 10),
      Vendor: expense.vendor ?? '',
      Category: category?.name ?? '',
      Amount: expense.amount,
      Confidence: expense.confidence,
      Document: document?.originalName ?? '',
    };
  }

  private toBuffer(rows: ExpenseRow[]): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ['Date', 'Vendor', 'Category', 'Amount', 'Confidence', 'Document'],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
