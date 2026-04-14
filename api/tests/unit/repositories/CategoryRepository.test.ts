import { describe, it, expect, beforeEach } from 'vitest';
import type { Category } from '@prisma/client';
import { CategoryRepository } from '../../../src/repositories/CategoryRepository.js';
import { createMockPrisma, type MockPrisma } from '../../helpers/mockPrisma.js';

const fakeCategory: Category = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Water',
  slug: 'water',
  isSystem: true,
};

describe('CategoryRepository', () => {
  let prisma: MockPrisma;
  let repo: CategoryRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repo = new CategoryRepository(prisma);
  });

  describe('findById', () => {
    it('should look up by id', async () => {
      prisma.category.findUnique.mockResolvedValue(fakeCategory);
      await expect(repo.findById('cat-1')).resolves.toEqual(fakeCategory);
    });

    it('should return null when not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(repo.findById('missing')).resolves.toBeNull();
    });
  });

  describe('findByIdForUser', () => {
    it('should scope lookup by userId', async () => {
      prisma.category.findFirst.mockResolvedValue(fakeCategory);
      await expect(repo.findByIdForUser('cat-1', 'user-1')).resolves.toEqual(fakeCategory);
      expect(prisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'cat-1', userId: 'user-1' },
      });
    });
  });

  describe('findBySlugForUser', () => {
    it('should use the composite unique key', async () => {
      prisma.category.findUnique.mockResolvedValue(fakeCategory);
      await expect(repo.findBySlugForUser('water', 'user-1')).resolves.toEqual(fakeCategory);
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { userId_slug: { userId: 'user-1', slug: 'water' } },
      });
    });
  });

  describe('findAllByUser', () => {
    it('should list categories for a user, sorted by name', async () => {
      prisma.category.findMany.mockResolvedValue([fakeCategory]);
      await expect(repo.findAllByUser('user-1')).resolves.toEqual([fakeCategory]);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('should create with the payload', async () => {
      prisma.category.create.mockResolvedValue(fakeCategory);
      const input = { userId: 'user-1', name: 'Water', slug: 'water', isSystem: true };
      await expect(repo.create(input)).resolves.toEqual(fakeCategory);
      expect(prisma.category.create).toHaveBeenCalledWith({ data: input });
    });

    it('should propagate unique constraint errors (duplicate slug)', async () => {
      const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      prisma.category.create.mockRejectedValue(err);
      await expect(
        repo.create({ userId: 'user-1', name: 'Water', slug: 'water' }),
      ).rejects.toThrow('Unique constraint');
    });
  });

  describe('createManyForUser', () => {
    it('should build the array with userId and skipDuplicates', async () => {
      prisma.category.createMany.mockResolvedValue({ count: 2 });
      await repo.createManyForUser('user-1', [
        { slug: 'water', name: 'Water', isSystem: true },
        { slug: 'rent', name: 'Rent', isSystem: true },
      ]);
      expect(prisma.category.createMany).toHaveBeenCalledWith({
        data: [
          { slug: 'water', name: 'Water', isSystem: true, userId: 'user-1' },
          { slug: 'rent', name: 'Rent', isSystem: true, userId: 'user-1' },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('delete', () => {
    it('should call prisma.category.delete', async () => {
      prisma.category.delete.mockResolvedValue(fakeCategory);
      await expect(repo.delete('cat-1')).resolves.toBeUndefined();
      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
    });
  });
});
