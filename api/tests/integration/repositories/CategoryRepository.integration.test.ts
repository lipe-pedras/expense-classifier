import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { CategoryRepository } from '../../../src/repositories/CategoryRepository.js';
import { testPrisma, resetDatabase } from '../../helpers/dbClient.js';
import { createTestUser, SYSTEM_CATEGORY_SEED } from '../../helpers/factories.js';

describe('CategoryRepository (integration)', () => {
  const repo = new CategoryRepository(testPrisma);

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
      name: 'Groceries',
      slug: 'groceries',
      isSystem: false,
    });
    expect(created.slug).toBe('groceries');

    const read = await repo.findById(created.id);
    expect(read?.name).toBe('Groceries');

    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });

  it('findBySlugForUser uses the composite unique key', async () => {
    const user = await createTestUser(testPrisma);
    const created = await repo.create({
      userId: user.id,
      name: 'Water',
      slug: 'water',
      isSystem: true,
    });
    const found = await repo.findBySlugForUser('water', user.id);
    expect(found?.id).toBe(created.id);
  });

  it('createManyForUser bulk-seeds system categories', async () => {
    const user = await createTestUser(testPrisma);
    await repo.createManyForUser(user.id, SYSTEM_CATEGORY_SEED.map((c) => ({ ...c, isSystem: true })));

    const all = await repo.findAllByUser(user.id);
    expect(all).toHaveLength(SYSTEM_CATEGORY_SEED.length);
    expect(all.every((c) => c.isSystem)).toBe(true);
    const slugs = new Set(all.map((c) => c.slug));
    for (const seed of SYSTEM_CATEGORY_SEED) {
      expect(slugs.has(seed.slug)).toBe(true);
    }
  });

  it('rejects duplicate (userId, slug) pairs', async () => {
    const user = await createTestUser(testPrisma);
    await repo.create({ userId: user.id, name: 'Water', slug: 'water', isSystem: true });
    await expect(
      repo.create({ userId: user.id, name: 'Water 2', slug: 'water', isSystem: false }),
    ).rejects.toThrow();
  });

  it('allows the same slug for different users', async () => {
    const [alice, bob] = await Promise.all([
      createTestUser(testPrisma),
      createTestUser(testPrisma),
    ]);
    await repo.create({ userId: alice.id, name: 'Water', slug: 'water', isSystem: true });
    await expect(
      repo.create({ userId: bob.id, name: 'Water', slug: 'water', isSystem: true }),
    ).resolves.toBeTruthy();

    expect((await repo.findAllByUser(alice.id))).toHaveLength(1);
    expect((await repo.findAllByUser(bob.id))).toHaveLength(1);
  });

  it('findByIdForUser scopes lookups', async () => {
    const [alice, bob] = await Promise.all([
      createTestUser(testPrisma),
      createTestUser(testPrisma),
    ]);
    const cat = await repo.create({
      userId: alice.id,
      name: 'Water',
      slug: 'water',
      isSystem: true,
    });
    expect((await repo.findByIdForUser(cat.id, alice.id))?.id).toBe(cat.id);
    expect(await repo.findByIdForUser(cat.id, bob.id)).toBeNull();
  });
});
