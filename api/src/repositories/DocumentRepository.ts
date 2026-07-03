import type { Document, ProcessingStatus } from '@prisma/client';
import { PrismaRepository } from './base/PrismaRepository.js';
import type {
  IDocumentRepository,
  CreateDocumentInput,
} from './interfaces/IRepository.js';

export class DocumentRepository
  extends PrismaRepository
  implements IDocumentRepository
{
  findById(id: string): Promise<Document | null> {
    return this.prisma.document.findUnique({ where: { id } });
  }

  findByIdForUser(id: string, userId: string): Promise<Document | null> {
    return this.prisma.document.findFirst({ where: { id, userId } });
  }

  findAllByUser(userId: string): Promise<Document[]> {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  create(data: CreateDocumentInput): Promise<Document> {
    return this.prisma.document.create({ data });
  }

  updateName(id: string, originalName: string): Promise<Document> {
    return this.prisma.document.update({ where: { id }, data: { originalName } });
  }

  updateStatus(id: string, status: ProcessingStatus): Promise<Document> {
    return this.prisma.document.update({ where: { id }, data: { status } });
  }

  incrementExpenseCount(id: string): Promise<Document> {
    return this.prisma.document.update({
      where: { id },
      data: { expenseCount: { increment: 1 } },
    });
  }

  resetExpenseCount(id: string): Promise<Document> {
    return this.prisma.document.update({
      where: { id },
      data: { expenseCount: 0 },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.document.delete({ where: { id } });
  }
}
