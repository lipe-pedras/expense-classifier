import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { DocumentRepository } from '../../../src/repositories/DocumentRepository.js';
import { testPrisma, resetDatabase } from '../../helpers/dbClient.js';
import { createTestUser, seedSystemCategories } from '../../helpers/factories.js';

describe('DocumentRepository (integration)', () => {
  const repo = new DocumentRepository(testPrisma);

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it('should complete the full CRUD lifecycle', async () => {
    const user = await createTestUser(testPrisma);

    const created = await repo.create({
      userId: user.id,
      originalName: 'bill.pdf',
      filePath: '/uploads/bill.pdf',
      fileType: 'PDF',
    });
    expect(created.status).toBe('PENDING');
    expect(created.expenseCount).toBe(0);

    const read = await repo.findById(created.id);
    expect(read?.originalName).toBe('bill.pdf');

    const updated = await repo.updateStatus(created.id, 'DONE');
    expect(updated.status).toBe('DONE');

    const incremented = await repo.incrementExpenseCount(created.id);
    expect(incremented.expenseCount).toBe(1);

    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });

  it('findByIdForUser should scope by user and return null for other users', async () => {
    const [alice, bob] = await Promise.all([
      createTestUser(testPrisma),
      createTestUser(testPrisma),
    ]);
    const doc = await repo.create({
      userId: alice.id,
      originalName: 'x.pdf',
      filePath: '/uploads/x.pdf',
      fileType: 'PDF',
    });

    expect((await repo.findByIdForUser(doc.id, alice.id))?.id).toBe(doc.id);
    expect(await repo.findByIdForUser(doc.id, bob.id)).toBeNull();
  });

  it('findAllByUser should return only that user\'s docs', async () => {
    const [alice, bob] = await Promise.all([
      createTestUser(testPrisma),
      createTestUser(testPrisma),
    ]);
    await repo.create({
      userId: alice.id,
      originalName: 'a.pdf',
      filePath: '/a.pdf',
      fileType: 'PDF',
    });
    await repo.create({
      userId: bob.id,
      originalName: 'b.pdf',
      filePath: '/b.pdf',
      fileType: 'PDF',
    });

    const aliceDocs = await repo.findAllByUser(alice.id);
    expect(aliceDocs).toHaveLength(1);
    expect(aliceDocs[0]!.originalName).toBe('a.pdf');

    const bobDocs = await repo.findAllByUser(bob.id);
    expect(bobDocs).toHaveLength(1);
    expect(bobDocs[0]!.originalName).toBe('b.pdf');
  });

  it('deleting a Document should cascade to its expenses', async () => {
    const user = await createTestUser(testPrisma);
    const [category] = await seedSystemCategories(testPrisma, user.id);
    const doc = await repo.create({
      userId: user.id,
      originalName: 'cascade.pdf',
      filePath: '/cascade.pdf',
      fileType: 'PDF',
    });

    await testPrisma.expense.createMany({
      data: [
        {
          userId: user.id,
          documentId: doc.id,
          categoryId: category!.id,
          segmentIndex: 0,
          amount: 100,
          currency: 'BRL',
          expenseDate: new Date('2026-03-01'),
          vendor: 'v1',
          confidence: 0.9,
          rawText: 'r1',
        },
        {
          userId: user.id,
          documentId: doc.id,
          categoryId: category!.id,
          segmentIndex: 1,
          amount: 200,
          currency: 'BRL',
          expenseDate: new Date('2026-03-02'),
          vendor: 'v2',
          confidence: 0.8,
          rawText: 'r2',
        },
      ],
    });

    expect(await testPrisma.expense.count({ where: { documentId: doc.id } })).toBe(2);

    await repo.delete(doc.id);

    expect(await testPrisma.expense.count({ where: { documentId: doc.id } })).toBe(0);
  });
});
