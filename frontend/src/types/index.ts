export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
export type FileType = 'PDF' | 'IMAGE';

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Document {
  id: string;
  userId: string;
  originalName: string;
  fileType: FileType;
  status: ProcessingStatus;
  expenseCount: number;
  uploadedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  slug: string;
  isSystem: boolean;
}

export interface Expense {
  id: string;
  documentId: string | null;
  userId: string;
  categoryId: string;
  segmentIndex: number;
  amount: number;
  currency: string;
  expenseDate: string;
  vendor: string | null;
  confidence: number;
  rawText: string;
  createdAt: string;
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

export interface ExpenseFilters {
  categorySlug?: string;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: string;
  maxAmount?: string;
}

export interface CreateExpensePayload {
  amount: number;
  currency?: string;
  expenseDate: string;
  vendor?: string | null;
  categoryId: string;
}

export interface WsMessage {
  type: 'job:completed' | 'job:failed';
  documentId: string;
  reason?: string;
}
