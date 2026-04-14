import type { Category } from '@prisma/client';
import { PrismaRepository } from './base/PrismaRepository.js';
import type {
  ICategoryRepository,
  CreateCategoryInput,
} from './interfaces/IRepository.js';

export class CategoryRepository
  extends PrismaRepository
  implements ICategoryRepository
{
  findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  findByIdForUser(id: string, userId: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, userId } });
  }

  findBySlugForUser(slug: string, userId: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { userId_slug: { userId, slug } },
    });
  }

  findAllByUser(userId: string): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  create(data: CreateCategoryInput): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  async createManyForUser(
    userId: string,
    data: Omit<CreateCategoryInput, 'userId'>[],
  ): Promise<void> {
    await this.prisma.category.createMany({
      data: data.map((d) => ({ ...d, userId })),
      skipDuplicates: true,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }
}
