import { PrismaClient } from '@prisma/client';

/**
 * Real PrismaClient used only by integration tests. Connection string is
 * supplied via DATABASE_URL in the integration test environment.
 */
export const testPrisma = new PrismaClient();

export async function resetDatabase(): Promise<void> {
  // Respect FK order: expenses -> documents -> categories -> users.
  await testPrisma.expense.deleteMany();
  await testPrisma.document.deleteMany();
  await testPrisma.category.deleteMany();
  await testPrisma.user.deleteMany();
}
