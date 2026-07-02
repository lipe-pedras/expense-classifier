import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, makeMockServices, type AppServices } from '../../helpers/testApp.js';
import { ExpenseNotFoundError } from '../../../src/errors/AppError.js';

const AUTH = { authorization: 'Bearer valid-token' };

const expense = {
  id: 'exp-1',
  userId: 'user-1',
  documentId: 'doc-1',
  categoryId: 'cat-1',
  segmentIndex: 0,
  amount: 100,
  currency: 'USD',
  expenseDate: new Date('2026-01-15').toISOString(),
  vendor: 'Acme',
  confidence: 0.9,
  rawText: 'raw',
  createdAt: new Date().toISOString(),
};

const dashboardData = {
  currentMonth: { byCategory: [{ categorySlug: 'rent', categoryName: 'Rent', total: 500 }] },
  history: [{ month: '2026-01', total: 500 }],
};

describe('ExpenseController', () => {
  let services: AppServices;
  let app: FastifyInstance;

  beforeEach(async () => {
    services = makeMockServices();
    app = await buildTestApp(services);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/expenses', () => {
    it('should return all expenses', async () => {
      (services.expenseService.list as any).mockResolvedValue([expense]);

      const res = await app.inject({ method: 'GET', url: '/api/expenses', headers: AUTH });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect(services.expenseService.list).toHaveBeenCalledWith('user-1', expect.any(Object));
    });

    it('should forward query filters to the service', async () => {
      (services.expenseService.list as any).mockResolvedValue([]);

      await app.inject({
        method: 'GET',
        url: '/api/expenses?categorySlug=rent&vendor=Acme&minAmount=50&maxAmount=200',
        headers: AUTH,
      });

      expect(services.expenseService.list).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          categorySlug: 'rent',
          vendor: 'Acme',
          minAmount: 50,
          maxAmount: 200,
        }),
      );
    });
  });

  describe('POST /api/expenses', () => {
    it('should create a manual expense and return 201', async () => {
      const created = { ...expense, documentId: null };
      (services.expenseService.create as any).mockResolvedValue(created);

      const res = await app.inject({
        method: 'POST',
        url: '/api/expenses',
        headers: AUTH,
        body: { amount: 100, expenseDate: '2026-01-15T00:00:00.000Z', categoryId: 'cat-1' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().documentId).toBeNull();
      expect(services.expenseService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ amount: 100, categoryId: 'cat-1' }),
      );
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/expenses',
        headers: AUTH,
        body: { amount: 100 },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/expenses/dashboard', () => {
    it('should return dashboard data with default 6 months', async () => {
      (services.expenseService.getDashboard as any).mockResolvedValue(dashboardData);

      const res = await app.inject({
        method: 'GET',
        url: '/api/expenses/dashboard',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(200);
      expect(services.expenseService.getDashboard).toHaveBeenCalledWith('user-1', 6);
    });

    it('should accept a custom months query param', async () => {
      (services.expenseService.getDashboard as any).mockResolvedValue(dashboardData);

      await app.inject({
        method: 'GET',
        url: '/api/expenses/dashboard?months=3',
        headers: AUTH,
      });

      expect(services.expenseService.getDashboard).toHaveBeenCalledWith('user-1', 3);
    });
  });

  describe('GET /api/expenses/:id', () => {
    it('should return the expense', async () => {
      (services.expenseService.getById as any).mockResolvedValue(expense);

      const res = await app.inject({
        method: 'GET',
        url: '/api/expenses/exp-1',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe('exp-1');
    });

    it('should return 404 for another user\'s expense', async () => {
      (services.expenseService.getById as any).mockRejectedValue(new ExpenseNotFoundError());

      const res = await app.inject({
        method: 'GET',
        url: '/api/expenses/exp-other',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/expenses/:id', () => {
    it('should return the updated expense', async () => {
      const updated = { ...expense, amount: 200 };
      (services.expenseService.update as any).mockResolvedValue(updated);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/expenses/exp-1',
        headers: AUTH,
        body: { amount: 200 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().amount).toBe(200);
    });
  });

  describe('DELETE /api/expenses/:id', () => {
    it('should return 204 on success', async () => {
      (services.expenseService.delete as any).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/expenses/exp-1',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(204);
    });

    it('should return 404 for another user\'s expense', async () => {
      (services.expenseService.delete as any).mockRejectedValue(new ExpenseNotFoundError());

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/expenses/exp-other',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
