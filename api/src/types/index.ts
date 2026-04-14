import type { ProcessingStatus, FileType } from '@prisma/client';

export type ExpenseOrderBy = 'date' | 'amount' | 'vendor' | 'category';
export type ExpenseOrderDirection = 'asc' | 'desc';

export interface ExpenseFilters {
  categorySlug?: string;
  dateFrom?: Date;
  dateTo?: Date;
  vendor?: string;
  minAmount?: number;
  maxAmount?: number;
  orderBy?: ExpenseOrderBy;
  order?: ExpenseOrderDirection;
}

export interface DashboardCategoryTotal {
  categorySlug: string;
  categoryName: string;
  total: number;
}

export interface DashboardMonthTotal {
  month: string;
  total: number;
}

export interface DashboardData {
  currentMonth: { byCategory: DashboardCategoryTotal[] };
  history: DashboardMonthTotal[];
}

export type { ProcessingStatus, FileType };
