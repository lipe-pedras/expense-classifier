import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '@prisma/client';
import { UserService } from '../../../src/services/UserService.js';
import type { IUserRepository } from '../../../src/repositories/interfaces/IRepository.js';
import type { IPasswordHasher } from '../../../src/services/AuthService.js';
import {
  UserNotFoundError,
  UserEmailTakenError,
  UserUsernameTakenError,
  AuthInvalidCredentialsError,
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

function makeHasher(): IPasswordHasher {
  return {
    hash: vi.fn(),
    compare: vi.fn(),
  };
}

describe('UserService', () => {
  let repo: IUserRepository;
  let hasher: IPasswordHasher;
  let service: UserService;

  beforeEach(() => {
    repo = makeRepo();
    hasher = makeHasher();
    service = new UserService(repo, hasher);
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

  describe('changePassword', () => {
    it('should hash and persist the new password when the current one matches', async () => {
      (repo.findById as any).mockResolvedValue(fakeUser);
      (hasher.compare as any).mockResolvedValue(true);
      (hasher.hash as any).mockResolvedValue('new-hash');

      await service.changePassword('user-1', 'current-pw', 'new-password');

      expect(hasher.compare).toHaveBeenCalledWith('current-pw', fakeUser.passwordHash);
      expect(hasher.hash).toHaveBeenCalledWith('new-password');
      expect(repo.update).toHaveBeenCalledWith('user-1', { passwordHash: 'new-hash' });
    });

    it('should throw AuthInvalidCredentialsError when the current password is wrong', async () => {
      (repo.findById as any).mockResolvedValue(fakeUser);
      (hasher.compare as any).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'wrong-pw', 'new-password'),
      ).rejects.toBeInstanceOf(AuthInvalidCredentialsError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should throw UserNotFoundError when the user does not exist', async () => {
      (repo.findById as any).mockResolvedValue(null);
      await expect(
        service.changePassword('missing', 'a', 'new-password'),
      ).rejects.toBeInstanceOf(UserNotFoundError);
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
