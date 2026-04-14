import type { Expense, Prisma } from '@prisma/client';
import { PrismaRepository } from './base/PrismaRepository.js';
import type {
  IExpenseRepository,
  CreateExpenseInput,
  UpdateExpenseInput,
} from './interfaces/IRepository.js';
import type {
  DashboardCategoryTotal,
  DashboardMonthTotal,
  ExpenseFilters,
} from '../types/index.js';

export class ExpenseRepository
  extends PrismaRepository
  implements IExpenseRepository
{
  findById(id: string): Promise<Expense | null> {
    return this.prisma.expense.findUnique({ where: { id } });
  }

  findByIdForUser(id: string, userId: string): Promise<Expense | null> {
    return this.prisma.expense.findFirst({ where: { id, userId } });
  }

  findAllByUser(userId: string, filters: ExpenseFilters = {}): Promise<Expense[]> {
    const where: Prisma.ExpenseWhereInput = { userId };

    if (filters.categorySlug) {
      where.category = { slug: filters.categorySlug };
    }
    if (filters.dateFrom || filters.dateTo) {
      where.expenseDate = {};
      if (filters.dateFrom) where.expenseDate.gte = filters.dateFrom;
      if (filters.dateTo) where.expenseDate.lte = filters.dateTo;
    }
    if (filters.vendor) {
      where.vendor = { contains: filters.vendor, mode: 'insensitive' };
    }
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) where.amount.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) where.amount.lte = filters.maxAmount;
    }

    const order = filters.order ?? 'desc';
    const orderBy = this.buildOrderBy(filters.orderBy ?? 'date', order);

    return this.prisma.expense.findMany({ where, orderBy });
  }

  findByDocument(documentId: string, userId: string): Promise<Expense[]> {
    return this.prisma.expense.findMany({
      where: { documentId, userId },
      orderBy: { segmentIndex: 'asc' },
    });
  }

  create(data: CreateExpenseInput): Promise<Expense> {
    return this.prisma.expense.create({ data });
  }

  update(id: string, data: UpdateExpenseInput): Promise<Expense> {
    return this.prisma.expense.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.expense.delete({ where: { id } });
  }

  async getCurrentMonthByCategory(userId: string): Promise<DashboardCategoryTotal[]> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const grouped = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      where: { userId, expenseDate: { gte: start, lt: end } },
      _sum: { amount: true },
    });

    if (grouped.length === 0) return [];

    const categories = await this.prisma.category.findMany({
      where: { id: { in: grouped.map((g) => g.categoryId) } },
    });
    const byId = new Map(categories.map((c) => [c.id, c]));

    return grouped.map((g) => {
      const cat = byId.get(g.categoryId);
      return {
        categorySlug: cat?.slug ?? 'unknown',
        categoryName: cat?.name ?? 'Unknown',
        total: g._sum.amount ?? 0,
      };
    });
  }

  async getHistoryByMonth(
    userId: string,
    months: number,
  ): Promise<DashboardMonthTotal[]> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const rows = await this.prisma.$queryRaw<Array<{ month: string; total: number }>>`
      SELECT to_char(date_trunc('month', "expenseDate"), 'YYYY-MM') AS month,
             SUM("amount")::float AS total
      FROM "Expense"
      WHERE "userId" = ${userId}
        AND "expenseDate" >= ${start}
      GROUP BY month
      ORDER BY month ASC
    `;

    return rows.map((r) => ({ month: r.month, total: Number(r.total) }));
  }

  private buildOrderBy(
    field: 'date' | 'amount' | 'vendor' | 'category',
    order: 'asc' | 'desc',
  ): Prisma.ExpenseOrderByWithRelationInput {
    switch (field) {
      case 'amount':
        return { amount: order };
      case 'vendor':
        return { vendor: order };
      case 'category':
        return { category: { name: order } };
      case 'date':
      default:
        return { expenseDate: order };
    }
  }
}
