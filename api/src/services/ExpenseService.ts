import type { Expense } from '@prisma/client';
import type {
  IExpenseRepository,
  ICategoryRepository,
  UpdateExpenseInput,
} from '../repositories/interfaces/IRepository.js';
import {
  ExpenseNotFoundError,
  CategoryNotFoundError,
} from '../errors/AppError.js';
import type { DashboardData, ExpenseFilters } from '../types/index.js';

export class ExpenseService {
  constructor(
    private readonly expenseRepo: IExpenseRepository,
    private readonly categoryRepo: ICategoryRepository,
  ) {}

  list(userId: string, filters: ExpenseFilters = {}): Promise<Expense[]> {
    return this.expenseRepo.findAllByUser(userId, filters);
  }

  async getById(userId: string, expenseId: string): Promise<Expense> {
    const exp = await this.expenseRepo.findByIdForUser(expenseId, userId);
    if (!exp) throw new ExpenseNotFoundError();
    return exp;
  }

  async update(
    userId: string,
    expenseId: string,
    input: UpdateExpenseInput,
  ): Promise<Expense> {
    const existing = await this.expenseRepo.findByIdForUser(expenseId, userId);
    if (!existing) throw new ExpenseNotFoundError();

    if (input.categoryId && input.categoryId !== existing.categoryId) {
      const category = await this.categoryRepo.findByIdForUser(input.categoryId, userId);
      if (!category) throw new CategoryNotFoundError();
    }

    return this.expenseRepo.update(expenseId, input);
  }

  async delete(userId: string, expenseId: string): Promise<void> {
    const existing = await this.expenseRepo.findByIdForUser(expenseId, userId);
    if (!existing) throw new ExpenseNotFoundError();
    await this.expenseRepo.delete(expenseId);
  }

  async getDashboard(userId: string, months: number): Promise<DashboardData> {
    const [byCategory, history] = await Promise.all([
      this.expenseRepo.getCurrentMonthByCategory(userId),
      this.expenseRepo.getHistoryByMonth(userId, months),
    ]);
    return {
      currentMonth: { byCategory },
      history,
    };
  }
}
