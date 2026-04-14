import { describe, it, expect, beforeEach } from 'vitest';
import type { Document } from '@prisma/client';
import { DocumentRepository } from '../../../src/repositories/DocumentRepository.js';
import { createMockPrisma, type MockPrisma } from '../../helpers/mockPrisma.js';

const fakeDoc: Document = {
  id: 'doc-1',
  userId: 'user-1',
  originalName: 'invoice.pdf',
  filePath: '/uploads/invoice.pdf',
  fileType: 'PDF',
  status: 'PENDING',
  expenseCount: 0,
  uploadedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('DocumentRepository', () => {
  let prisma: MockPrisma;
  let repo: DocumentRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repo = new DocumentRepository(prisma);
  });

  describe('findById', () => {
    it('should query by id', async () => {
      prisma.document.findUnique.mockResolvedValue(fakeDoc);
      await expect(repo.findById('doc-1')).resolves.toEqual(fakeDoc);
      expect(prisma.document.findUnique).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    });

    it('should return null when not found', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(repo.findById('missing')).resolves.toBeNull();
    });
  });

  describe('findByIdForUser', () => {
    it('should scope the lookup by userId', async () => {
      prisma.document.findFirst.mockResolvedValue(fakeDoc);
      await expect(repo.findByIdForUser('doc-1', 'user-1')).resolves.toEqual(fakeDoc);
      expect(prisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'doc-1', userId: 'user-1' },
      });
    });

    it('should return null when the doc belongs to a different user', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(repo.findByIdForUser('doc-1', 'user-2')).resolves.toBeNull();
    });
  });

  describe('findAllByUser', () => {
    it('should list user docs ordered by uploadedAt desc', async () => {
      prisma.document.findMany.mockResolvedValue([fakeDoc]);
      await expect(repo.findAllByUser('user-1')).resolves.toEqual([fakeDoc]);
      expect(prisma.document.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { uploadedAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('should create with the given payload', async () => {
      prisma.document.create.mockResolvedValue(fakeDoc);
      const input = {
        userId: 'user-1',
        originalName: 'invoice.pdf',
        filePath: '/uploads/invoice.pdf',
        fileType: 'PDF' as const,
      };
      await expect(repo.create(input)).resolves.toEqual(fakeDoc);
      expect(prisma.document.create).toHaveBeenCalledWith({ data: input });
    });
  });

  describe('updateStatus', () => {
    it('should update the status field', async () => {
      const updated = { ...fakeDoc, status: 'DONE' as const };
      prisma.document.update.mockResolvedValue(updated);
      await expect(repo.updateStatus('doc-1', 'DONE')).resolves.toEqual(updated);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { status: 'DONE' },
      });
    });
  });

  describe('incrementExpenseCount', () => {
    it('should increment by 1', async () => {
      const updated = { ...fakeDoc, expenseCount: 1 };
      prisma.document.update.mockResolvedValue(updated);
      await expect(repo.incrementExpenseCount('doc-1')).resolves.toEqual(updated);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { expenseCount: { increment: 1 } },
      });
    });
  });

  describe('delete', () => {
    it('should call prisma.document.delete', async () => {
      prisma.document.delete.mockResolvedValue(fakeDoc);
      await expect(repo.delete('doc-1')).resolves.toBeUndefined();
      expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
    });
  });
});
