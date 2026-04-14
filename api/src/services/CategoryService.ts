import type { Category } from '@prisma/client';
import type { ICategoryRepository } from '../repositories/interfaces/IRepository.js';
import {
  CategoryNotFoundError,
  CategorySlugTakenError,
  CategorySystemDeleteError,
} from '../errors/AppError.js';

export interface CreateCategoryInput {
  name: string;
  slug: string;
}

export class CategoryService {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  list(userId: string): Promise<Category[]> {
    return this.categoryRepo.findAllByUser(userId);
  }

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    const existing = await this.categoryRepo.findBySlugForUser(input.slug, userId);
    if (existing) throw new CategorySlugTakenError();
    return this.categoryRepo.create({
      userId,
      name: input.name,
      slug: input.slug,
      isSystem: false,
    });
  }

  async delete(userId: string, categoryId: string): Promise<void> {
    const category = await this.categoryRepo.findByIdForUser(categoryId, userId);
    if (!category) throw new CategoryNotFoundError();
    if (category.isSystem) throw new CategorySystemDeleteError();
    await this.categoryRepo.delete(categoryId);
  }
}
