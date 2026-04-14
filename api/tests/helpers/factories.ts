import type { PrismaClient, User, Category, Document, FileType } from '@prisma/client';
import { randomUUID } from 'node:crypto';

export const SYSTEM_CATEGORY_SEED: ReadonlyArray<{ slug: string; name: string }> = [
  { slug: 'rent', name: 'Rent' },
  { slug: 'water', name: 'Water' },
  { slug: 'electricity', name: 'Electricity' },
  { slug: 'internet', name: 'Internet' },
  { slug: 'insurance', name: 'Insurance' },
  { slug: 'other', name: 'Other' },
];

export function userInput(overrides: Partial<{ username: string; email: string; passwordHash: string }> = {}) {
  const tag = randomUUID().slice(0, 8);
  return {
    username: `user_${tag}`,
    email: `user_${tag}@test.example`,
    passwordHash: 'hashed-password',
    ...overrides,
  };
}

export async function createTestUser(
  prisma: PrismaClient,
  overrides: Partial<{ username: string; email: string; passwordHash: string }> = {},
): Promise<User> {
  return prisma.user.create({ data: userInput(overrides) });
}

export async function seedSystemCategories(
  prisma: PrismaClient,
  userId: string,
): Promise<Category[]> {
  await prisma.category.createMany({
    data: SYSTEM_CATEGORY_SEED.map((c) => ({ ...c, userId, isSystem: true })),
  });
  return prisma.category.findMany({ where: { userId } });
}

export async function createTestDocument(
  prisma: PrismaClient,
  userId: string,
  overrides: Partial<{ originalName: string; filePath: string; fileType: FileType }> = {},
): Promise<Document> {
  return prisma.document.create({
    data: {
      userId,
      originalName: overrides.originalName ?? 'invoice.pdf',
      filePath: overrides.filePath ?? `/uploads/${randomUUID()}.pdf`,
      fileType: overrides.fileType ?? 'PDF',
    },
  });
}
