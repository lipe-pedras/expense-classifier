import type { PrismaClient } from '@prisma/client';

/**
 * Abstract base for all Prisma-backed repositories. Holds a shared reference to
 * the PrismaClient so concrete repositories can read/write through it.
 */
export abstract class PrismaRepository {
  constructor(protected readonly prisma: PrismaClient) {}
}
