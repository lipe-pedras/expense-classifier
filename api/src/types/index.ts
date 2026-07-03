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

// ---------- Natural-language charts ----------
// The LLM may only emit these whitelisted tokens; the API compiles them into
// parameterised SQL (never concatenating LLM text) scoped to the user.
export type ChartMetric = 'sum_amount' | 'count' | 'avg_amount';
export type ChartGroupBy = 'category' | 'month' | 'vendor' | 'currency';
export type ChartDateRange =
  | 'last_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_year'
  | 'all';
export type ChartType = 'bar' | 'pie' | 'line' | 'table';

export interface ChartSpec {
  metric: ChartMetric;
  groupBy: ChartGroupBy;
  dateRange: ChartDateRange;
  chart: ChartType;
}

export interface ChartRow {
  label: string;
  value: number;
}

export interface ChartResult {
  chart: ChartType;
  rows: ChartRow[];
}

export type { ProcessingStatus, FileType };
