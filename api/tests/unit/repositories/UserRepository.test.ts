import { describe, it, expect, beforeEach } from 'vitest';
import type { User } from '@prisma/client';
import { UserRepository } from '../../../src/repositories/UserRepository.js';
import { createMockPrisma, type MockPrisma } from '../../helpers/mockPrisma.js';

const fakeUser: User = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  passwordHash: 'hash',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('UserRepository', () => {
  let prisma: MockPrisma;
  let repo: UserRepository;

  beforeEach(() => {
    prisma = createMockPrisma();
    repo = new UserRepository(prisma);
  });

  describe('findById', () => {
    it('should return the user when found', async () => {
      prisma.user.findUnique.mockResolvedValue(fakeUser);
      await expect(repo.findById('user-1')).resolves.toEqual(fakeUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('should return null when not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(repo.findById('missing')).resolves.toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should query by email', async () => {
      prisma.user.findUnique.mockResolvedValue(fakeUser);
      await expect(repo.findByEmail('alice@example.com')).resolves.toEqual(fakeUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
    });

    it('should return null when no match', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(repo.findByEmail('nobody@example.com')).resolves.toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should query by username', async () => {
      prisma.user.findUnique.mockResolvedValue(fakeUser);
      await expect(repo.findByUsername('alice')).resolves.toEqual(fakeUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'alice' },
      });
    });
  });

  describe('create', () => {
    it('should forward the payload to prisma.user.create', async () => {
      prisma.user.create.mockResolvedValue(fakeUser);
      const input = { username: 'alice', email: 'alice@example.com', passwordHash: 'hash' };
      await expect(repo.create(input)).resolves.toEqual(fakeUser);
      expect(prisma.user.create).toHaveBeenCalledWith({ data: input });
    });

    it('should propagate duplicate-key errors from prisma', async () => {
      const err = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      prisma.user.create.mockRejectedValue(err);
      await expect(
        repo.create({ username: 'alice', email: 'alice@example.com', passwordHash: 'h' }),
      ).rejects.toThrow('Unique constraint');
    });
  });

  describe('update', () => {
    it('should update by id', async () => {
      const updated = { ...fakeUser, email: 'new@example.com' };
      prisma.user.update.mockResolvedValue(updated);
      await expect(repo.update('user-1', { email: 'new@example.com' })).resolves.toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { email: 'new@example.com' },
      });
    });
  });

  describe('delete', () => {
    it('should call prisma.user.delete', async () => {
      prisma.user.delete.mockResolvedValue(fakeUser);
      await expect(repo.delete('user-1')).resolves.toBeUndefined();
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });
  });
});
