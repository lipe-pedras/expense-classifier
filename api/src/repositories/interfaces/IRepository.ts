import type {
  User,
  Document,
  Expense,
  Category,
  ProcessingStatus,
  FileType,
} from '@prisma/client';
import type {
  DashboardCategoryTotal,
  DashboardMonthTotal,
  ExpenseFilters,
} from '../../types/index.js';

/**
 * Generic repository contract. Every repository supports lookup and delete by id.
 * Domain-specific methods live on the concrete interfaces below.
 */
export interface IRepository<TEntity> {
  findById(id: string): Promise<TEntity | null>;
  delete(id: string): Promise<void>;
}

// ---------- User ----------

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  passwordHash?: string;
}

export interface IUserRepository extends IRepository<User> {
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
  update(id: string, data: UpdateUserInput): Promise<User>;
  /**
   * Creates a user and seeds a list of categories for them in a single
   * transaction. Used by AuthService.register so that a user is never
   * persisted without their default category set.
   */
  createWithCategories(
    user: CreateUserInput,
    categories: Omit<CreateCategoryInput, 'userId'>[],
  ): Promise<User>;
  deleteCascade(id: string): Promise<void>;
}

// ---------- Document ----------

export interface CreateDocumentInput {
  userId: string;
  originalName: string;
  filePath: string;
  fileType: FileType;
}

export interface IDocumentRepository extends IRepository<Document> {
  findByIdForUser(id: string, userId: string): Promise<Document | null>;
  findAllByUser(userId: string): Promise<Document[]>;
  create(data: CreateDocumentInput): Promise<Document>;
  updateStatus(id: string, status: ProcessingStatus): Promise<Document>;
  incrementExpenseCount(id: string): Promise<Document>;
  resetExpenseCount(id: string): Promise<Document>;
}

// ---------- Expense ----------

export interface CreateExpenseInput {
  userId: string;
  documentId: string | null;
  categoryId: string;
  segmentIndex: number;
  amount: number;
  currency: string;
  expenseDate: Date;
  vendor: string | null;
  confidence: number;
  rawText: string;
}

export interface UpdateExpenseInput {
  amount?: number;
  currency?: string;
  expenseDate?: Date;
  vendor?: string | null;
  categoryId?: string;
}

export interface IExpenseRepository extends IRepository<Expense> {
  findByIdForUser(id: string, userId: string): Promise<Expense | null>;
  findAllByUser(userId: string, filters?: ExpenseFilters): Promise<Expense[]>;
  findByDocument(documentId: string, userId: string): Promise<Expense[]>;
  /** Removes all expenses for a document. Returns the number deleted. */
  deleteByDocumentId(documentId: string): Promise<number>;
  create(data: CreateExpenseInput): Promise<Expense>;
  update(id: string, data: UpdateExpenseInput): Promise<Expense>;
  getCurrentMonthByCategory(userId: string): Promise<DashboardCategoryTotal[]>;
  getHistoryByMonth(userId: string, months: number): Promise<DashboardMonthTotal[]>;
}

// ---------- Category ----------

export interface CreateCategoryInput {
  userId: string;
  name: string;
  slug: string;
  isSystem?: boolean;
}

export interface ICategoryRepository extends IRepository<Category> {
  findByIdForUser(id: string, userId: string): Promise<Category | null>;
  findBySlugForUser(slug: string, userId: string): Promise<Category | null>;
  findAllByUser(userId: string): Promise<Category[]>;
  create(data: CreateCategoryInput): Promise<Category>;
  createManyForUser(
    userId: string,
    data: Omit<CreateCategoryInput, 'userId'>[],
  ): Promise<void>;
}
