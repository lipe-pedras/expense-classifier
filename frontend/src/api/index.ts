import { apiClient } from './client';
import type {
  AuthResult,
  Category,
  CreateExpensePayload,
  Document,
  Expense,
  DashboardData,
  ExpenseFilters,
  User,
} from '@/types';

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    apiClient.post<AuthResult>('/api/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthResult>('/api/auth/login', data).then((r) => r.data),
};

export const categoriesApi = {
  list: () => apiClient.get<Category[]>('/api/categories').then((r) => r.data),
  create: (data: { name: string }) =>
    apiClient.post<Category>('/api/categories', data).then((r) => r.data),
  update: (id: string, data: { name: string }) =>
    apiClient.put<Category>(`/api/categories/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/api/categories/${id}`),
};

export const documentsApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<Document>('/api/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  list: () => apiClient.get<Document[]>('/api/documents').then((r) => r.data),
  rename: (id: string, originalName: string) =>
    apiClient.put<Document>(`/api/documents/${id}`, { originalName }).then((r) => r.data),
  reprocess: (id: string) =>
    apiClient.post<Document>(`/api/documents/${id}/reprocess`).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/api/documents/${id}`),
};

export const usersApi = {
  me: () => apiClient.get<User>('/api/users/me').then((r) => r.data),
  update: (data: { username?: string; email?: string }) =>
    apiClient.put<User>('/api/users/me', data).then((r) => r.data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.put('/api/users/me/password', data),
  deleteAccount: (data: { password: string; username: string }) =>
    apiClient.delete('/api/users/me', { data }),
};

export const expensesApi = {
  list: (filters?: ExpenseFilters) =>
    apiClient.get<Expense[]>('/api/expenses', { params: filters }).then((r) => r.data),
  create: (data: CreateExpensePayload) =>
    apiClient.post<Expense>('/api/expenses', data).then((r) => r.data),
  dashboard: (months = 6) =>
    apiClient
      .get<DashboardData>('/api/expenses/dashboard', { params: { months } })
      .then((r) => r.data),
  update: (id: string, data: Partial<Pick<Expense, 'amount' | 'currency' | 'expenseDate' | 'vendor' | 'categoryId'>>) =>
    apiClient.put<Expense>(`/api/expenses/${id}`, data).then((r) => r.data),
  delete: (id: string) => apiClient.delete(`/api/expenses/${id}`),
  export: async (filters?: ExpenseFilters) => {
    const res = await apiClient.get('/api/expenses/export', {
      params: filters,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  },
};
