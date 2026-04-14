import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '@prisma/client';
import { UserService } from '../../../src/services/UserService.js';
import type { IUserRepository } from '../../../src/repositories/interfaces/IRepository.js';
import {
  UserNotFoundError,
  UserEmailTakenError,
  UserUsernameTakenError,
} from '../../../src/errors/AppError.js';

const fakeUser: User = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  passwordHash: 'hashed',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

function makeRepo(): IUserRepository {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByUsername: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createWithCategories: vi.fn(),
    deleteCascade: vi.fn(),
  };
}

describe('UserService', () => {
  let repo: IUserRepository;
  let service: UserService;

  beforeEach(() => {
    repo = makeRepo();
    service = new UserService(repo);
  });

  describe('getById', () => {
    it('should return the sanitized user when found', async () => {
      (repo.findById as any).mockResolvedValue(fakeUser);
      const view = await service.getById('user-1');
      expect(view).toEqual({
        id: 'user-1',
        username: 'alice',
        email: 'alice@example.com',
        createdAt: fakeUser.createdAt,
      });
      expect(view).not.toHaveProperty('passwordHash');
    });

    it('should throw UserNotFoundError when missing', async () => {
      (repo.findById as any).mockResolvedValue(null);
      await expect(service.getById('missing')).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe('update', () => {
    it('should update the user when inputs are unique', async () => {
      (repo.findById as any).mockResolvedValue(fakeUser);
      (repo.findByEmail as any).mockResolvedValue(null);
      (repo.update as any).mockResolvedValue({ ...fakeUser, email: 'new@example.com' });

      const view = await service.update('user-1', { email: 'new@example.com' });

      expect(view.email).toBe('new@example.com');
      expect(repo.update).toHaveBeenCalledWith('user-1', { email: 'new@example.com' });
    });

    it('should skip uniqueness check when email is unchanged', async () => {
      (repo.findById as any).mockResolvedValue(fakeUser);
      (repo.update as any).mockResolvedValue(fakeUser);

      await service.update('user-1', { email: fakeUser.email });

      expect(repo.findByEmail).not.toHaveBeenCalled();
    });

    it('should throw UserEmailTakenError when new email belongs to another user', async () => {
      (repo.findById as any).mockResolvedValue(fakeUser);
      (repo.findByEmail as any).mockResolvedValue({ ...fakeUser, id: 'other' });

      await expect(
        service.update('user-1', { email: 'new@example.com' }),
      ).rejects.toBeInstanceOf(UserEmailTakenError);
    });

    it('should throw UserUsernameTakenError when new username belongs to another user', async () => {
      (repo.findById as any).mockResolvedValue(fakeUser);
      (repo.findByUsername as any).mockResolvedValue({ ...fakeUser, id: 'other' });

      await expect(
        service.update('user-1', { username: 'bob' }),
      ).rejects.toBeInstanceOf(UserUsernameTakenError);
    });

    it('should throw UserNotFoundError when the user does not exist', async () => {
      (repo.findById as any).mockResolvedValue(null);
      await expect(service.update('missing', { email: 'x@x' })).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });

  describe('delete', () => {
    it('should cascade-delete the user', async () => {
      (repo.findById as any).mockResolvedValue(fakeUser);
      await service.delete('user-1');
      expect(repo.deleteCascade).toHaveBeenCalledWith('user-1');
    });

    it('should throw UserNotFoundError when missing', async () => {
      (repo.findById as any).mockResolvedValue(null);
      await expect(service.delete('missing')).rejects.toBeInstanceOf(UserNotFoundError);
      expect(repo.deleteCascade).not.toHaveBeenCalled();
    });
  });
});
