import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Category } from '@prisma/client';
import { CategoryService } from '../../../src/services/CategoryService.js';
import type { ICategoryRepository } from '../../../src/repositories/interfaces/IRepository.js';
import {
  CategoryNameTakenError,
  CategoryNotFoundError,
  CategorySlugTakenError,
  CategorySystemDeleteError,
  CategorySystemModifyError,
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
    findByNameForUser: vi.fn(),
    findAllByUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
    it('should create a category with a slug derived from the name', async () => {
      (repo.findByNameForUser as any).mockResolvedValue(null);
      (repo.findBySlugForUser as any).mockResolvedValue(null);
      (repo.create as any).mockResolvedValue(userCategory);

      const result = await service.create('user-1', { name: 'Gym Membership' });

      expect(repo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Gym Membership',
        slug: 'gym-membership',
        isSystem: false,
      });
      expect(result).toEqual(userCategory);
    });

    it('should trim the name before deriving the slug', async () => {
      (repo.findByNameForUser as any).mockResolvedValue(null);
      (repo.findBySlugForUser as any).mockResolvedValue(null);
      (repo.create as any).mockResolvedValue(userCategory);

      await service.create('user-1', { name: '  Travel  ' });

      expect(repo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'Travel',
        slug: 'travel',
        isSystem: false,
      });
    });

    it('should throw CategoryNameTakenError when the name already exists for the user', async () => {
      (repo.findByNameForUser as any).mockResolvedValue(userCategory);
      await expect(
        service.create('user-1', { name: 'Gym' }),
      ).rejects.toBeInstanceOf(CategoryNameTakenError);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should throw CategorySlugTakenError when the derived slug collides', async () => {
      (repo.findByNameForUser as any).mockResolvedValue(null);
      (repo.findBySlugForUser as any).mockResolvedValue(userCategory);
      await expect(
        service.create('user-1', { name: 'Gym!' }),
      ).rejects.toBeInstanceOf(CategorySlugTakenError);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should rename a user category and re-derive the slug', async () => {
      (repo.findByIdForUser as any).mockResolvedValue(userCategory);
      (repo.findByNameForUser as any).mockResolvedValue(null);
      (repo.findBySlugForUser as any).mockResolvedValue(null);
      (repo.update as any).mockResolvedValue({ ...userCategory, name: 'Fitness', slug: 'fitness' });

      const result = await service.update('user-1', 'cat-2', { name: 'Fitness' });

      expect(repo.update).toHaveBeenCalledWith('cat-2', { name: 'Fitness', slug: 'fitness' });
      expect(result.name).toBe('Fitness');
    });

    it('should allow keeping the same name (excludes itself from the uniqueness check)', async () => {
      (repo.findByIdForUser as any).mockResolvedValue(userCategory);
      (repo.findByNameForUser as any).mockResolvedValue(userCategory);
      (repo.findBySlugForUser as any).mockResolvedValue(userCategory);
      (repo.update as any).mockResolvedValue(userCategory);

      await expect(service.update('user-1', 'cat-2', { name: 'Gym' })).resolves.toEqual(userCategory);
      expect(repo.update).toHaveBeenCalled();
    });

    it('should throw CategoryNotFoundError when the category is missing or not owned', async () => {
      (repo.findByIdForUser as any).mockResolvedValue(null);
      await expect(service.update('user-1', 'cat-x', { name: 'X' })).rejects.toBeInstanceOf(
        CategoryNotFoundError,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should throw CategorySystemModifyError when renaming a system category', async () => {
      (repo.findByIdForUser as any).mockResolvedValue(systemCategory);
      await expect(service.update('user-1', 'cat-1', { name: 'X' })).rejects.toBeInstanceOf(
        CategorySystemModifyError,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should throw CategoryNameTakenError when renaming to another category\'s name', async () => {
      (repo.findByIdForUser as any).mockResolvedValue(userCategory);
      (repo.findByNameForUser as any).mockResolvedValue({ ...userCategory, id: 'cat-3', name: 'Food' });
      await expect(service.update('user-1', 'cat-2', { name: 'Food' })).rejects.toBeInstanceOf(
        CategoryNameTakenError,
      );
      expect(repo.update).not.toHaveBeenCalled();
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
