import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { Category } from '@prisma/client';
import { ChartRepository } from '../../../src/repositories/ChartRepository.js';
import { testPrisma, resetDatabase } from '../../helpers/dbClient.js';
import { createTestUser, seedSystemCategories } from '../../helpers/factories.js';
import type { ChartSpec } from '../../../src/types/index.js';

const repo = new ChartRepository(testPrisma);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function addExpense(
  userId: string,
  categoryId: string,
  data: Partial<{ amount: number; currency: string; vendor: string | null; expenseDate: Date }> = {},
) {
  return testPrisma.expense.create({
    data: {
      userId,
      categoryId,
      amount: data.amount ?? 100,
      currency: data.currency ?? 'BRL',
      vendor: 'vendor' in data ? data.vendor ?? null : 'Acme',
      expenseDate: data.expenseDate ?? new Date(),
      confidence: 0.9,
      rawText: 'x',
    },
  });
}

describe('ChartRepository (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it('sums amounts by category, scoped to the user', async () => {
    const user = await createTestUser(testPrisma);
    const cats = await seedSystemCategories(testPrisma, user.id);
    const bySlug = new Map(cats.map((c: Category) => [c.slug, c]));

    await addExpense(user.id, bySlug.get('rent')!.id, { amount: 1000 });
    await addExpense(user.id, bySlug.get('rent')!.id, { amount: 500 });
    await addExpense(user.id, bySlug.get('water')!.id, { amount: 80 });

    const spec: ChartSpec = { metric: 'sum_amount', groupBy: 'category', dateRange: 'all', chart: 'bar' };
    const rows = await repo.aggregate(user.id, spec);

    const map = new Map(rows.map((r) => [r.label, r.value]));
    expect(map.get('Rent')).toBe(1500);
    expect(map.get('Water')).toBe(80);
    // Highest first
    expect(rows[0].label).toBe('Rent');
  });

  it('never returns another user\'s data', async () => {
    const user = await createTestUser(testPrisma);
    const other = await createTestUser(testPrisma);
    const cats = await seedSystemCategories(testPrisma, user.id);
    const otherCats = await seedSystemCategories(testPrisma, other.id);

    await addExpense(user.id, cats[0].id, { amount: 100 });
    await addExpense(other.id, otherCats[0].id, { amount: 9999 });

    const spec: ChartSpec = { metric: 'sum_amount', groupBy: 'category', dateRange: 'all', chart: 'bar' };
    const rows = await repo.aggregate(user.id, spec);

    const total = rows.reduce((acc, r) => acc + r.value, 0);
    expect(total).toBe(100);
  });

  it('counts expenses by vendor', async () => {
    const user = await createTestUser(testPrisma);
    const cats = await seedSystemCategories(testPrisma, user.id);

    await addExpense(user.id, cats[0].id, { vendor: 'Store A' });
    await addExpense(user.id, cats[0].id, { vendor: 'Store A' });
    await addExpense(user.id, cats[0].id, { vendor: 'Store B' });

    const spec: ChartSpec = { metric: 'count', groupBy: 'vendor', dateRange: 'all', chart: 'bar' };
    const rows = await repo.aggregate(user.id, spec);

    const map = new Map(rows.map((r) => [r.label, r.value]));
    expect(map.get('Store A')).toBe(2);
    expect(map.get('Store B')).toBe(1);
  });

  it('applies the date-range filter', async () => {
    const user = await createTestUser(testPrisma);
    const cats = await seedSystemCategories(testPrisma, user.id);

    await addExpense(user.id, cats[0].id, { amount: 10, expenseDate: new Date() });
    await addExpense(user.id, cats[0].id, { amount: 999, expenseDate: daysAgo(200) });

    const spec: ChartSpec = { metric: 'sum_amount', groupBy: 'category', dateRange: 'last_month', chart: 'bar' };
    const rows = await repo.aggregate(user.id, spec);

    const total = rows.reduce((acc, r) => acc + r.value, 0);
    expect(total).toBe(10);
  });

  it('groups null vendors under "Unknown"', async () => {
    const user = await createTestUser(testPrisma);
    const cats = await seedSystemCategories(testPrisma, user.id);
    await addExpense(user.id, cats[0].id, { vendor: null });

    const spec: ChartSpec = { metric: 'count', groupBy: 'vendor', dateRange: 'all', chart: 'table' };
    const rows = await repo.aggregate(user.id, spec);

    expect(rows).toEqual([{ label: 'Unknown', value: 1 }]);
  });
});
