import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient, type Category } from '@prisma/client';
import { SqlChartRepository, SqlChartError } from '../../../src/repositories/SqlChartRepository.js';
import { testPrisma, resetDatabase } from '../../helpers/dbClient.js';
import { createTestUser, seedSystemCategories } from '../../helpers/factories.js';

// The chart_reader role connects to the same test DB as testPrisma, but with
// the least-privilege credentials created by the RLS migration.
const chartUrl = (process.env.CHART_DATABASE_URL ??
  (process.env.DATABASE_URL ?? '').replace(
    /\/\/[^@]+@/,
    '//chart_reader:chart_reader_pw@',
  ));
const chartPrisma = new PrismaClient({ datasources: { db: { url: chartUrl } } });
const repo = new SqlChartRepository(chartPrisma);

async function addExpense(userId: string, categoryId: string, amount: number) {
  return testPrisma.expense.create({
    data: {
      userId,
      categoryId,
      amount,
      currency: 'BRL',
      vendor: 'Acme',
      expenseDate: new Date(),
      confidence: 0.9,
      rawText: 'x',
    },
  });
}

describe('SqlChartRepository (integration)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await chartPrisma.$disconnect();
    await testPrisma.$disconnect();
  });

  it('runs a valid SELECT and returns label/value rows for the user', async () => {
    const user = await createTestUser(testPrisma);
    const cats = await seedSystemCategories(testPrisma, user.id);
    const bySlug = new Map(cats.map((c: Category) => [c.slug, c]));
    await addExpense(user.id, bySlug.get('rent')!.id, 1000);
    await addExpense(user.id, bySlug.get('rent')!.id, 500);

    const sql = `
      SELECT c."name" AS label, SUM(e."amount") AS value
      FROM "Expense" e JOIN "Category" c ON c."id" = e."categoryId"
      GROUP BY c."name"`;
    const rows = await repo.run(user.id, sql);

    expect(rows).toEqual([{ label: 'Rent', value: 1500 }]);
  });

  it('never sees another user\'s rows even for an unscoped SELECT (RLS)', async () => {
    const user = await createTestUser(testPrisma);
    const other = await createTestUser(testPrisma);
    const cats = await seedSystemCategories(testPrisma, user.id);
    const otherCats = await seedSystemCategories(testPrisma, other.id);
    await addExpense(user.id, cats[0].id, 100);
    await addExpense(other.id, otherCats[0].id, 9999);

    // Deliberately omits any WHERE userId filter — RLS must still fence it.
    const sql = `SELECT 'all' AS label, COALESCE(SUM(e."amount"), 0) AS value FROM "Expense" e`;
    const rows = await repo.run(user.id, sql);

    expect(rows).toEqual([{ label: 'all', value: 100 }]);
  });

  it('rejects a write attempt (role is SELECT-only)', async () => {
    const user = await createTestUser(testPrisma);
    await expect(repo.run(user.id, 'DELETE FROM "Expense"')).rejects.toBeInstanceOf(SqlChartError);
  });

  it('surfaces the Postgres error for invalid SQL (unknown column)', async () => {
    const user = await createTestUser(testPrisma);
    await expect(
      repo.run(user.id, 'SELECT nope AS label, 1 AS value FROM "Expense"'),
    ).rejects.toBeInstanceOf(SqlChartError);
  });

  it('rejects SQL that does not project label/value', async () => {
    const user = await createTestUser(testPrisma);
    await expect(
      repo.run(user.id, 'SELECT 1 AS foo, 2 AS bar FROM "Expense"'),
    ).rejects.toBeInstanceOf(SqlChartError);
  });

  it('kills a query that exceeds the statement timeout', async () => {
    const user = await createTestUser(testPrisma);
    const sql = `SELECT 'a' AS label, 1 AS value FROM (SELECT pg_sleep(4)) s`;
    await expect(repo.run(user.id, sql)).rejects.toBeInstanceOf(SqlChartError);
  });
});
