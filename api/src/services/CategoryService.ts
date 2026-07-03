import type { Category } from '@prisma/client';
import type { ICategoryRepository } from '../repositories/interfaces/IRepository.js';
import { slugify } from '../utils/slugify.js';
import {
  CategoryNameTakenError,
  CategoryNotFoundError,
  CategorySlugTakenError,
  CategorySystemDeleteError,
  CategorySystemModifyError,
} from '../errors/AppError.js';

export interface CreateCategoryInput {
  name: string;
}

export interface UpdateCategoryInput {
  name: string;
}

export class CategoryService {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  list(userId: string): Promise<Category[]> {
    return this.categoryRepo.findAllByUser(userId);
  }

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    const name = input.name.trim();
    const slug = slugify(name);
    await this.assertNameAndSlugFree(userId, name, slug);
    return this.categoryRepo.create({ userId, name, slug, isSystem: false });
  }

  async update(userId: string, categoryId: string, input: UpdateCategoryInput): Promise<Category> {
    const category = await this.categoryRepo.findByIdForUser(categoryId, userId);
    if (!category) throw new CategoryNotFoundError();
    if (category.isSystem) throw new CategorySystemModifyError();

    const name = input.name.trim();
    const slug = slugify(name);
    await this.assertNameAndSlugFree(userId, name, slug, categoryId);
    return this.categoryRepo.update(categoryId, { name, slug });
  }

  async delete(userId: string, categoryId: string): Promise<void> {
    const category = await this.categoryRepo.findByIdForUser(categoryId, userId);
    if (!category) throw new CategoryNotFoundError();
    if (category.isSystem) throw new CategorySystemDeleteError();
    await this.categoryRepo.delete(categoryId);
  }

  /**
   * Rejects a name/slug that another category of the same user already owns.
   * When `excludeId` is given (rename), a category may keep its own name/slug.
   */
  private async assertNameAndSlugFree(
    userId: string,
    name: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const byName = await this.categoryRepo.findByNameForUser(name, userId);
    if (byName && byName.id !== excludeId) throw new CategoryNameTakenError();

    const bySlug = await this.categoryRepo.findBySlugForUser(slug, userId);
    if (bySlug && bySlug.id !== excludeId) throw new CategorySlugTakenError();
  }
}
