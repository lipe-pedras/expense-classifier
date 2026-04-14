import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ExpenseRepository } from '../../../src/repositories/ExpenseRepository.js';
import { testPrisma, resetDatabase } from '../../helpers/dbClient.js';
import {
  createTestUser,
  createTestDocument,
  seedSystemCategories,
} from '../../helpers/factories.js';

describe('ExpenseRepository (integration)', () => {
  const repo = new ExpenseRepository(testPrisma);

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  async function seedUserWithDocAndCategories() {
    const user = await createTestUser(testPrisma);
    const categories = await seedSystemCategories(testPrisma, user.id);
    const doc = await createTestDocument(testPrisma, user.id);
    return { user, categories, doc };
  }

  it('should complete the full CRUD lifecycle', async () => {
    const { user, categories, doc } = await seedUserWithDocAndCategories();
    const waterCat = categories.find((c) => c.slug === 'water')!;

    const created = await repo.create({
      userId: user.id,
      documentId: doc.id,
      categoryId: waterCat.id,
      segmentIndex: 0,
      amount: 89.5,
      currency: 'BRL',
      expenseDate: new Date('2026-03-15'),
      vendor: 'COPASA',
      confidence: 0.94,
      rawText: 'water bill',
    });
    expect(created.id).toBeTruthy();

    const read = await repo.findById(created.id);
    expect(read?.vendor).toBe('COPASA');
    expect(read?.amount).toBe(89.5);

    const updated = await repo.update(created.id, { amount: 100, vendor: 'COPASA MG' });
    expect(updated.amount).toBe(100);
    expect(updated.vendor).toBe('COPASA MG');

    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });

  it('findByIdForUser enforces user scoping', async () => {
    const { user: alice, categories, doc } = await seedUserWithDocAndCategories();
    const bob = await createTestUser(testPrisma);

    const expense = await repo.create({
      userId: alice.id,
      documentId: doc.id,
      categoryId: categories[0]!.id,
      segmentIndex: 0,
      amount: 50,
      currency: 'BRL',
      expenseDate: new Date('2026-03-01'),
      vendor: null,
      confidence: 0.5,
      rawText: 'r',
    });

    expect((await repo.findByIdForUser(expense.id, alice.id))?.id).toBe(expense.id);
    expect(await repo.findByIdForUser(expense.id, bob.id)).toBeNull();
  });

  it('findAllByUser supports filters and ordering', async () => {
    const { user, categories, doc } = await seedUserWithDocAndCategories();
    const water = categories.find((c) => c.slug === 'water')!;
    const rent = categories.find((c) => c.slug === 'rent')!;

    await repo.create({
      userId: user.id,
      documentId: doc.id,
      categoryId: water.id,
      segmentIndex: 0,
      amount: 80,
      currency: 'BRL',
      expenseDate: new Date('2026-02-10'),
      vendor: 'COPASA',
      confidence: 0.9,
      rawText: 'r',
    });
    await repo.create({
      userId: user.id,
      documentId: doc.id,
      categoryId: rent.id,
      segmentIndex: 1,
      amount: 1500,
      currency: 'BRL',
      expenseDate: new Date('2026-03-01'),
      vendor: 'Landlord',
      confidence: 0.95,
      rawText: 'r',
    });

    const all = await repo.findAllByUser(user.id);
    expect(all).toHaveLength(2);

    const onlyWater = await repo.findAllByUser(user.id, { categorySlug: 'water' });
    expect(onlyWater).toHaveLength(1);
    expect(onlyWater[0]!.vendor).toBe('COPASA');

    const dateRanged = await repo.findAllByUser(user.id, {
      dateFrom: new Date('2026-02-15'),
      dateTo: new Date('2026-03-31'),
    });
    expect(dateRanged).toHaveLength(1);
    expect(dateRanged[0]!.vendor).toBe('Landlord');

    const byVendor = await repo.findAllByUser(user.id, { vendor: 'cop' });
    expect(byVendor).toHaveLength(1);
    expect(byVendor[0]!.vendor).toBe('COPASA');

    const byAmount = await repo.findAllByUser(user.id, { minAmount: 1000 });
    expect(byAmount).toHaveLength(1);
    expect(byAmount[0]!.amount).toBe(1500);

    const byAmountAsc = await repo.findAllByUser(user.id, { orderBy: 'amount', order: 'asc' });
    expect(byAmountAsc.map((e) => e.amount)).toEqual([80, 1500]);
  });

  it('data is isolated between users', async () => {
    const { user: alice, categories: aliceCats, doc: aliceDoc } =
      await seedUserWithDocAndCategories();
    const { user: bob, categories: bobCats, doc: bobDoc } =
      await seedUserWithDocAndCategories();

    await repo.create({
      userId: alice.id,
      documentId: aliceDoc.id,
      categoryId: aliceCats[0]!.id,
      segmentIndex: 0,
      amount: 10,
      currency: 'BRL',
      expenseDate: new Date('2026-03-01'),
      vendor: 'a',
      confidence: 0.9,
      rawText: 'r',
    });
    await repo.create({
      userId: bob.id,
      documentId: bobDoc.id,
      categoryId: bobCats[0]!.id,
      segmentIndex: 0,
      amount: 20,
      currency: 'BRL',
      expenseDate: new Date('2026-03-01'),
      vendor: 'b',
      confidence: 0.9,
      rawText: 'r',
    });

    expect(await repo.findAllByUser(alice.id)).toHaveLength(1);
    expect(await repo.findAllByUser(bob.id)).toHaveLength(1);
  });

  it('getCurrentMonthByCategory returns aggregated totals for the current month', async () => {
    const { user, categories, doc } = await seedUserWithDocAndCategories();
    const water = categories.find((c) => c.slug === 'water')!;
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10);

    await repo.create({
      userId: user.id,
      documentId: doc.id,
      categoryId: water.id,
      segmentIndex: 0,
      amount: 50,
      currency: 'BRL',
      expenseDate: thisMonth,
      vendor: null,
      confidence: 0.9,
      rawText: 'r',
    });
    await repo.create({
      userId: user.id,
      documentId: doc.id,
      categoryId: water.id,
      segmentIndex: 1,
      amount: 30,
      currency: 'BRL',
      expenseDate: thisMonth,
      vendor: null,
      confidence: 0.9,
      rawText: 'r',
    });

    const result = await repo.getCurrentMonthByCategory(user.id);
    expect(result).toHaveLength(1);
    expect(result[0]!.categorySlug).toBe('water');
    expect(result[0]!.total).toBe(80);
  });

  it('getHistoryByMonth groups expenses by month for the last N months', async () => {
    const { user, categories, doc } = await seedUserWithDocAndCategories();
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 5);

    await repo.create({
      userId: user.id,
      documentId: doc.id,
      categoryId: categories[0]!.id,
      segmentIndex: 0,
      amount: 100,
      currency: 'BRL',
      expenseDate: thisMonth,
      vendor: null,
      confidence: 0.9,
      rawText: 'r',
    });
    await repo.create({
      userId: user.id,
      documentId: doc.id,
      categoryId: categories[0]!.id,
      segmentIndex: 1,
      amount: 200,
      currency: 'BRL',
      expenseDate: lastMonth,
      vendor: null,
      confidence: 0.9,
      rawText: 'r',
    });

    const history = await repo.getHistoryByMonth(user.id, 3);
    expect(history.length).toBeGreaterThanOrEqual(2);
    const totals = new Map(history.map((h) => [h.month, h.total]));
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    expect(totals.get(fmt(thisMonth))).toBe(100);
    expect(totals.get(fmt(lastMonth))).toBe(200);
  });
});
