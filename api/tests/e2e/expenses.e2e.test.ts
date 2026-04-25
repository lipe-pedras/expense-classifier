import { describe, it, expect, beforeAll, afterAll, beforeEach, onTestFailed } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildE2eApp, type E2eApp } from './helpers/buildE2eApp.js';
import { testPrisma } from '../helpers/dbClient.js';
import {
  registerAndLogin,
  authHeader,
  uploadTestFile,
  waitForDocumentDone,
} from './helpers/e2eFactories.js';

let ctx: E2eApp;
let app: FastifyInstance;

beforeAll(async () => {
  ctx = await buildE2eApp();
  app = ctx.app;
  await app.ready();
});

afterAll(async () => {
  await ctx.mockWorker.close();
  await ctx.queueEvents.close();
  await ctx.redis.quit();
  await app.close();
  await testPrisma.$disconnect();
});

beforeEach(async () => {
  await ctx.resetBetweenTests();
  ctx.clearExchangeLogs();
  onTestFailed(() => {
    console.error('\n--- E2E Exchange Log ---');
    console.error(JSON.stringify(ctx.getExchangeLogs(), null, 2));
  });
});


/** Register, upload a file, wait for mock worker to create an expense, return context. */
async function seedExpense(token: string) {
  const doc = await uploadTestFile(app, token);
  await waitForDocumentDone(app, token, doc.id);
  const expenses = await testPrisma.expense.findMany({ where: { documentId: doc.id } });
  return { doc, expense: expenses[0] };
}

describe('GET /api/expenses', () => {
  it('returns the seeded expense', async () => {
    const { accessToken } = await registerAndLogin(app);
    await seedExpense(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const list = res.json() as unknown[];
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by categorySlug', async () => {
    const { accessToken } = await registerAndLogin(app);
    await seedExpense(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses?categorySlug=other',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const list = res.json() as unknown[];
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when filter matches nothing', async () => {
    const { accessToken } = await registerAndLogin(app);
    await seedExpense(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses?categorySlug=rent',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('does not return another user\'s expenses', async () => {
    const { accessToken: tok1 } = await registerAndLogin(app);
    const { accessToken: tok2 } = await registerAndLogin(app);
    await seedExpense(tok2);

    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses',
      headers: authHeader(tok1),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/expenses' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/expenses/dashboard', () => {
  it('returns the dashboard shape with seeded expense', async () => {
    const { accessToken } = await registerAndLogin(app);
    await seedExpense(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses/dashboard',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('currentMonth');
    expect(body).toHaveProperty('history');
    expect(Array.isArray(body.currentMonth.byCategory)).toBe(true);
    expect(Array.isArray(body.history)).toBe(true);
  });

  it('respects the months query param', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses/dashboard?months=3',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.history.length).toBeLessThanOrEqual(3);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/expenses/dashboard' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/expenses/:id', () => {
  it('returns a specific expense', async () => {
    const { accessToken } = await registerAndLogin(app);
    const { expense } = await seedExpense(accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/expenses/${expense.id}`,
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(expense.id);
    expect(res.json().amount).toBe(42);
  });

  it('returns 404 for another user\'s expense', async () => {
    const { accessToken: tok1 } = await registerAndLogin(app);
    const { accessToken: tok2 } = await registerAndLogin(app);
    const { expense } = await seedExpense(tok2);

    const res = await app.inject({
      method: 'GET',
      url: `/api/expenses/${expense.id}`,
      headers: authHeader(tok1),
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for non-existent id', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses/nonexistent',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /api/expenses/:id', () => {
  it('updates expense amount', async () => {
    const { accessToken } = await registerAndLogin(app);
    const { expense } = await seedExpense(accessToken);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/expenses/${expense.id}`,
      headers: authHeader(accessToken),
      payload: { amount: 99.99 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().amount).toBe(99.99);

    const dbExpense = await testPrisma.expense.findUnique({ where: { id: expense.id } });
    expect(dbExpense!.amount).toBe(99.99);
  });

  it('updates vendor to null', async () => {
    const { accessToken } = await registerAndLogin(app);
    const { expense } = await seedExpense(accessToken);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/expenses/${expense.id}`,
      headers: authHeader(accessToken),
      payload: { vendor: null },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().vendor).toBeNull();
  });

  it('returns 404 for non-existent expense', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/expenses/nonexistent',
      headers: authHeader(accessToken),
      payload: { amount: 10 },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when categoryId does not exist', async () => {
    const { accessToken } = await registerAndLogin(app);
    const { expense } = await seedExpense(accessToken);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/expenses/${expense.id}`,
      headers: authHeader(accessToken),
      payload: { categoryId: 'nonexistent-category-id' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/expenses/someid',
      payload: { amount: 10 },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /api/expenses/:id', () => {
  it('deletes an expense', async () => {
    const { accessToken } = await registerAndLogin(app);
    const { expense } = await seedExpense(accessToken);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/expenses/${expense.id}`,
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(204);
    const dbExpense = await testPrisma.expense.findUnique({ where: { id: expense.id } });
    expect(dbExpense).toBeNull();
  });

  it('returns 404 for non-existent expense', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/expenses/nonexistent',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/expenses/someid' });
    expect(res.statusCode).toBe(401);
  });
});
