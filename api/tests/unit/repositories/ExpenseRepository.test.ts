import { describe, it, expect, beforeEach } from 'vitest';
import type { Expense } from '@prisma/client';
import { ExpenseRepository } from '../../../src/repositories/ExpenseRepository.js';
import { createMockPrisma, type MockPrisma } from '../../helpers/mockPrisma.js';

const fakeExpense: Expense = {
  id: 'exp-1',
  documentId: 'doc-1',
  userId: 'user-1',
  categoryId: 'cat-1',
  segmentIndex: 0,
  amount: 100,
  currency: 'BRL',
  expenseDate: new Date('2026-03-15T00:00:00Z'),
  vendor: 'COPASA',
  confidence: 0.9,
  rawText: 'raw',
  createdAt: new Date('2026-03-15T00:00:00Z'),
};

describe('ExpenseRepository', () => {
  let prisma: MockPrisma;
  let repo: ExpenseRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repo = new ExpenseRepository(prisma);
  });

  describe('findById', () => {
    it('should look up by id', async () => {
      prisma.expense.findUnique.mockResolvedValue(fakeExpense);
      await expect(repo.findById('exp-1')).resolves.toEqual(fakeExpense);
    });
  });

  describe('findByIdForUser', () => {
    it('should scope by userId', async () => {
      prisma.expense.findFirst.mockResolvedValue(fakeExpense);
      await expect(repo.findByIdForUser('exp-1', 'user-1')).resolves.toEqual(fakeExpense);
      expect(prisma.expense.findFirst).toHaveBeenCalledWith({
        where: { id: 'exp-1', userId: 'user-1' },
      });
    });

    it('should return null when owned by someone else', async () => {
      prisma.expense.findFirst.mockResolvedValue(null);
      await expect(repo.findByIdForUser('exp-1', 'user-2')).resolves.toBeNull();
    });
  });

  describe('findAllByUser', () => {
    it('should apply no filters when none provided (default date desc)', async () => {
      prisma.expense.findMany.mockResolvedValue([fakeExpense]);
      await repo.findAllByUser('user-1');
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { expenseDate: 'desc' },
      });
    });

    it('should filter by categorySlug', async () => {
      prisma.expense.findMany.mockResolvedValue([]);
      await repo.findAllByUser('user-1', { categorySlug: 'water' });
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', category: { slug: 'water' } },
        orderBy: { expenseDate: 'desc' },
      });
    });

    it('should filter by date range', async () => {
      prisma.expense.findMany.mockResolvedValue([]);
      const from = new Date('2026-01-01');
      const to = new Date('2026-03-31');
      await repo.findAllByUser('user-1', { dateFrom: from, dateTo: to });
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', expenseDate: { gte: from, lte: to } },
        orderBy: { expenseDate: 'desc' },
      });
    });

    it('should filter by vendor substring (case-insensitive)', async () => {
      prisma.expense.findMany.mockResolvedValue([]);
      await repo.findAllByUser('user-1', { vendor: 'cop' });
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', vendor: { contains: 'cop', mode: 'insensitive' } },
        orderBy: { expenseDate: 'desc' },
      });
    });

    it('should filter by amount range', async () => {
      prisma.expense.findMany.mockResolvedValue([]);
      await repo.findAllByUser('user-1', { minAmount: 10, maxAmount: 500 });
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', amount: { gte: 10, lte: 500 } },
        orderBy: { expenseDate: 'desc' },
      });
    });

    it.each([
      ['amount', { amount: 'asc' }],
      ['vendor', { vendor: 'asc' }],
      ['category', { category: { name: 'asc' } }],
      ['date', { expenseDate: 'asc' }],
    ] as const)('should honour orderBy %s', async (field, expected) => {
      prisma.expense.findMany.mockResolvedValue([]);
      await repo.findAllByUser('user-1', { orderBy: field, order: 'asc' });
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: expected,
      });
    });
  });

  describe('findByDocument', () => {
    it('should scope by document and user, sorted by segmentIndex', async () => {
      prisma.expense.findMany.mockResolvedValue([fakeExpense]);
      await expect(repo.findByDocument('doc-1', 'user-1')).resolves.toEqual([fakeExpense]);
      expect(prisma.expense.findMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-1', userId: 'user-1' },
        orderBy: { segmentIndex: 'asc' },
      });
    });
  });

  describe('create / update / delete', () => {
    it('create should forward payload', async () => {
      prisma.expense.create.mockResolvedValue(fakeExpense);
      const data = {
        userId: 'user-1',
        documentId: 'doc-1',
        categoryId: 'cat-1',
        segmentIndex: 0,
        amount: 100,
        currency: 'BRL',
        expenseDate: new Date('2026-03-15T00:00:00Z'),
        vendor: 'COPASA',
        confidence: 0.9,
        rawText: 'raw',
      };
      await expect(repo.create(data)).resolves.toEqual(fakeExpense);
      expect(prisma.expense.create).toHaveBeenCalledWith({ data });
    });

    it('update should update by id', async () => {
      prisma.expense.update.mockResolvedValue(fakeExpense);
      await repo.update('exp-1', { amount: 200 });
      expect(prisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: { amount: 200 },
      });
    });

    it('delete should call prisma.expense.delete', async () => {
      prisma.expense.delete.mockResolvedValue(fakeExpense);
      await expect(repo.delete('exp-1')).resolves.toBeUndefined();
    });
  });

  describe('getCurrentMonthByCategory', () => {
    it('should return aggregated totals joined with category metadata', async () => {
      prisma.expense.groupBy.mockResolvedValue([
        // @ts-expect-error mocked groupBy shape is not narrowed
        { categoryId: 'cat-1', _sum: { amount: 150 } },
        // @ts-expect-error mocked groupBy shape is not narrowed
        { categoryId: 'cat-2', _sum: { amount: 80 } },
      ]);
      prisma.category.findMany.mockResolvedValue([
        // @ts-expect-error partial Category
        { id: 'cat-1', slug: 'water', name: 'Water' },
        // @ts-expect-error partial Category
        { id: 'cat-2', slug: 'other', name: 'Other' },
      ]);

      const result = await repo.getCurrentMonthByCategory('user-1');
      expect(result).toEqual([
        { categorySlug: 'water', categoryName: 'Water', total: 150 },
        { categorySlug: 'other', categoryName: 'Other', total: 80 },
      ]);
    });

    it('should return empty array when no expenses this month', async () => {
      prisma.expense.groupBy.mockResolvedValue([]);
      await expect(repo.getCurrentMonthByCategory('user-1')).resolves.toEqual([]);
      expect(prisma.category.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getHistoryByMonth', () => {
    it('should return raw aggregated rows as numbers', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { month: '2026-02', total: 100 },
        { month: '2026-03', total: 200 },
      ] as unknown as never);
      const result = await repo.getHistoryByMonth('user-1', 3);
      expect(result).toEqual([
        { month: '2026-02', total: 100 },
        { month: '2026-03', total: 200 },
      ]);
    });
  });
});
