import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Category } from '@prisma/client';
import { CategoryService } from '../../../src/services/CategoryService.js';
import type { ICategoryRepository } from '../../../src/repositories/interfaces/IRepository.js';
import {
  CategoryNotFoundError,
  CategorySlugTakenError,
  CategorySystemDeleteError,
} from '../../../src/errors/AppError.js';

const systemCategory: Category = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Rent',
  slug: 'rent',
  isSystem: true,
};

const userCategory: Category = {
  id: 'cat-2',
  userId: 'user-1',
  name: 'Gym',
  slug: 'gym',
  isSystem: false,
};

function makeRepo(): ICategoryRepository {
  return {
    findById: vi.fn(),
    findByIdForUser: vi.fn(),
    findBySlugForUser: vi.fn(),
    findAllByUser: vi.fn(),
    create: vi.fn(),
    createManyForUser: vi.fn(),
    delete: vi.fn(),
  };
}

describe('CategoryService', () => {
  let repo: ICategoryRepository;
  let service: CategoryService;

  beforeEach(() => {
    repo = makeRepo();
    service = new CategoryService(repo);
  });

  describe('list', () => {
    it('should return categories for the user', async () => {
      (repo.findAllByUser as any).mockResolvedValue([systemCategory]);
      await expect(service.list('user-1')).resolves.toEqual([systemCategory]);
      expect(repo.findAllByUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('create', () => {
    it('should create a non-system category', async () => {
      (repo.findBySlugForUser as any).mockResolvedValue(null);
      (repo.create as any).mockResolvedValue(userCategory);

      const result = await service.create('user-1', { name: 'Gym', slug: 'gym' });

      expect(repo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Gym',
        slug: 'gym',
        isSystem: false,
      });
      expect(result).toEqual(userCategory);
    });

    it('should throw CategorySlugTakenError when the slug already exists for the user', async () => {
      (repo.findBySlugForUser as any).mockResolvedValue(userCategory);
      await expect(
        service.create('user-1', { name: 'Gym', slug: 'gym' }),
      ).rejects.toBeInstanceOf(CategorySlugTakenError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a non-system category', async () => {
      (repo.findByIdForUser as any).mockResolvedValue(userCategory);
      await service.delete('user-1', 'cat-2');
      expect(repo.delete).toHaveBeenCalledWith('cat-2');
    });

    it('should throw CategoryNotFoundError when category is missing or owned by someone else', async () => {
      (repo.findByIdForUser as any).mockResolvedValue(null);
      await expect(service.delete('user-1', 'cat-x')).rejects.toBeInstanceOf(
        CategoryNotFoundError,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('should throw CategorySystemDeleteError when deleting a system category', async () => {
      (repo.findByIdForUser as any).mockResolvedValue(systemCategory);
      await expect(service.delete('user-1', 'cat-1')).rejects.toBeInstanceOf(
        CategorySystemDeleteError,
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
