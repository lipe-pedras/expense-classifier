import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Category, Expense } from '@prisma/client';
import { ExpenseService } from '../../../src/services/ExpenseService.js';
import type {
  ICategoryRepository,
  IExpenseRepository,
} from '../../../src/repositories/interfaces/IRepository.js';
import {
  CategoryNotFoundError,
  ExpenseNotFoundError,
} from '../../../src/errors/AppError.js';

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

const otherCategory: Category = {
  id: 'cat-2',
  userId: 'user-1',
  name: 'Water',
  slug: 'water',
  isSystem: true,
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

describe('ExpenseService', () => {
  let expenseRepo: IExpenseRepository;
  let categoryRepo: ICategoryRepository;
  let service: ExpenseService;

  beforeEach(() => {
    expenseRepo = makeExpenseRepo();
    categoryRepo = makeCategoryRepo();
    service = new ExpenseService(expenseRepo, categoryRepo);
  });

  describe('list', () => {
    it('should forward filters to the repository', async () => {
      const filters = { categorySlug: 'rent', vendor: 'Acme' };
      (expenseRepo.findAllByUser as any).mockResolvedValue([fakeExpense]);

      await expect(service.list('user-1', filters)).resolves.toEqual([fakeExpense]);
      expect(expenseRepo.findAllByUser).toHaveBeenCalledWith('user-1', filters);
    });
  });

  describe('getById', () => {
    it('should return the expense when owned by the user', async () => {
      (expenseRepo.findByIdForUser as any).mockResolvedValue(fakeExpense);
      await expect(service.getById('user-1', 'exp-1')).resolves.toEqual(fakeExpense);
    });

    it('should throw ExpenseNotFoundError when owned by another user', async () => {
      (expenseRepo.findByIdForUser as any).mockResolvedValue(null);
      await expect(service.getById('user-2', 'exp-1')).rejects.toBeInstanceOf(
        ExpenseNotFoundError,
      );
    });
  });

  describe('update', () => {
    it('should update the expense when inputs are valid', async () => {
      (expenseRepo.findByIdForUser as any).mockResolvedValue(fakeExpense);
      (expenseRepo.update as any).mockResolvedValue({ ...fakeExpense, amount: 200 });

      const result = await service.update('user-1', 'exp-1', { amount: 200 });

      expect(result.amount).toBe(200);
      expect(categoryRepo.findByIdForUser).not.toHaveBeenCalled();
    });

    it('should verify category ownership when categoryId changes', async () => {
      (expenseRepo.findByIdForUser as any).mockResolvedValue(fakeExpense);
      (categoryRepo.findByIdForUser as any).mockResolvedValue(otherCategory);
      (expenseRepo.update as any).mockResolvedValue({ ...fakeExpense, categoryId: 'cat-2' });

      await service.update('user-1', 'exp-1', { categoryId: 'cat-2' });

      expect(categoryRepo.findByIdForUser).toHaveBeenCalledWith('cat-2', 'user-1');
    });

    it('should throw CategoryNotFoundError when the new category is not owned by the user', async () => {
      (expenseRepo.findByIdForUser as any).mockResolvedValue(fakeExpense);
      (categoryRepo.findByIdForUser as any).mockResolvedValue(null);

      await expect(
        service.update('user-1', 'exp-1', { categoryId: 'cat-x' }),
      ).rejects.toBeInstanceOf(CategoryNotFoundError);
      expect(expenseRepo.update).not.toHaveBeenCalled();
    });

    it('should throw ExpenseNotFoundError when the expense belongs to another user', async () => {
      (expenseRepo.findByIdForUser as any).mockResolvedValue(null);
      await expect(
        service.update('user-2', 'exp-1', { amount: 50 }),
      ).rejects.toBeInstanceOf(ExpenseNotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete the expense when owned by the user', async () => {
      (expenseRepo.findByIdForUser as any).mockResolvedValue(fakeExpense);
      await service.delete('user-1', 'exp-1');
      expect(expenseRepo.delete).toHaveBeenCalledWith('exp-1');
    });

    it('should throw ExpenseNotFoundError when owned by another user', async () => {
      (expenseRepo.findByIdForUser as any).mockResolvedValue(null);
      await expect(service.delete('user-2', 'exp-1')).rejects.toBeInstanceOf(
        ExpenseNotFoundError,
      );
      expect(expenseRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('getDashboard', () => {
    it('should return aggregated data from the repository', async () => {
      const byCategory = [{ categorySlug: 'rent', categoryName: 'Rent', total: 500 }];
      const history = [{ month: '2026-01', total: 500 }];
      (expenseRepo.getCurrentMonthByCategory as any).mockResolvedValue(byCategory);
      (expenseRepo.getHistoryByMonth as any).mockResolvedValue(history);

      const result = await service.getDashboard('user-1', 6);

      expect(expenseRepo.getHistoryByMonth).toHaveBeenCalledWith('user-1', 6);
      expect(result).toEqual({
        currentMonth: { byCategory },
        history,
      });
    });
  });
});
