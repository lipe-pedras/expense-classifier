import type { PrismaClient } from '@prisma/client';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';

export type MockPrisma = DeepMockProxy<PrismaClient>;

export function createMockPrisma(): MockPrisma {
  return mockDeep<PrismaClient>();
}
