import type { User } from '@prisma/client';
import { PrismaRepository } from './base/PrismaRepository.js';
import type {
  IUserRepository,
  CreateUserInput,
  UpdateUserInput,
  CreateCategoryInput,
} from './interfaces/IRepository.js';

export class UserRepository extends PrismaRepository implements IUserRepository {
  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  create(data: CreateUserInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: UpdateUserInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  createWithCategories(
    user: CreateUserInput,
    categories: Omit<CreateCategoryInput, 'userId'>[],
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: user });
      if (categories.length > 0) {
        await tx.category.createMany({
          data: categories.map((c) => ({
            ...c,
            userId: created.id,
            isSystem: c.isSystem ?? true,
          })),
        });
      }
      return created;
    });
  }

  async deleteCascade(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({ where: { userId: id } });
      await tx.document.deleteMany({ where: { userId: id } });
      await tx.category.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });
  }
}
