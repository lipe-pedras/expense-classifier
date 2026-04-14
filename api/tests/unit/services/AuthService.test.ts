import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { User } from '@prisma/client';
import { AuthService } from '../../../src/services/AuthService.js';
import type { IUserRepository } from '../../../src/repositories/interfaces/IRepository.js';
import type { IJwtService } from '../../../src/services/JwtService.js';
import type { IPasswordHasher } from '../../../src/services/AuthService.js';
import {
  AuthInvalidCredentialsError,
  UserEmailTakenError,
  UserUsernameTakenError,
} from '../../../src/errors/AppError.js';
import { SYSTEM_CATEGORIES } from '../../../src/config.js';

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

function makeJwt(): IJwtService {
  return {
    signAccessToken: vi.fn().mockReturnValue('access-token'),
    signRefreshToken: vi.fn().mockReturnValue('refresh-token'),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
  };
}

function makeHasher(): IPasswordHasher {
  return {
    hash: vi.fn().mockResolvedValue('hashed'),
    compare: vi.fn(),
  };
}

describe('AuthService', () => {
  let repo: IUserRepository;
  let jwt: IJwtService;
  let hasher: IPasswordHasher;
  let service: AuthService;

  beforeEach(() => {
    repo = makeRepo();
    jwt = makeJwt();
    hasher = makeHasher();
    service = new AuthService(repo, jwt, hasher);
  });

  describe('register', () => {
    const input = { username: 'alice', email: 'alice@example.com', password: 'pw' };

    it('should create the user, seed system categories, and return tokens', async () => {
      (repo.findByEmail as any).mockResolvedValue(null);
      (repo.findByUsername as any).mockResolvedValue(null);
      (repo.createWithCategories as any).mockResolvedValue(fakeUser);

      const result = await service.register(input);

      expect(hasher.hash).toHaveBeenCalledWith('pw');
      expect(repo.createWithCategories).toHaveBeenCalledWith(
        { username: 'alice', email: 'alice@example.com', passwordHash: 'hashed' },
        SYSTEM_CATEGORIES.map((c) => ({ ...c, isSystem: true })),
      );
      expect(result).toEqual({
        user: {
          id: fakeUser.id,
          username: fakeUser.username,
          email: fakeUser.email,
          createdAt: fakeUser.createdAt,
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw UserEmailTakenError when the email is already used', async () => {
      (repo.findByEmail as any).mockResolvedValue(fakeUser);
      await expect(service.register(input)).rejects.toBeInstanceOf(UserEmailTakenError);
      expect(repo.createWithCategories).not.toHaveBeenCalled();
    });

    it('should throw UserUsernameTakenError when the username is already used', async () => {
      (repo.findByEmail as any).mockResolvedValue(null);
      (repo.findByUsername as any).mockResolvedValue(fakeUser);
      await expect(service.register(input)).rejects.toBeInstanceOf(UserUsernameTakenError);
      expect(repo.createWithCategories).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const input = { email: 'alice@example.com', password: 'pw' };

    it('should return tokens when credentials are valid', async () => {
      (repo.findByEmail as any).mockResolvedValue(fakeUser);
      (hasher.compare as any).mockResolvedValue(true);

      const result = await service.login(input);

      expect(hasher.compare).toHaveBeenCalledWith('pw', 'hashed');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });

    it('should throw AuthInvalidCredentialsError when the email is unknown', async () => {
      (repo.findByEmail as any).mockResolvedValue(null);
      await expect(service.login(input)).rejects.toBeInstanceOf(AuthInvalidCredentialsError);
    });

    it('should throw AuthInvalidCredentialsError when the password is wrong', async () => {
      (repo.findByEmail as any).mockResolvedValue(fakeUser);
      (hasher.compare as any).mockResolvedValue(false);
      await expect(service.login(input)).rejects.toBeInstanceOf(AuthInvalidCredentialsError);
    });
  });

  describe('refresh', () => {
    it('should issue new tokens for a valid refresh token', async () => {
      (jwt.verifyRefreshToken as any).mockReturnValue({ userId: 'user-1' });
      (repo.findById as any).mockResolvedValue(fakeUser);

      const result = await service.refresh('old-refresh');

      expect(jwt.verifyRefreshToken).toHaveBeenCalledWith('old-refresh');
      expect(result.accessToken).toBe('access-token');
    });

    it('should throw AuthInvalidCredentialsError if the user no longer exists', async () => {
      (jwt.verifyRefreshToken as any).mockReturnValue({ userId: 'user-1' });
      (repo.findById as any).mockResolvedValue(null);

      await expect(service.refresh('x')).rejects.toBeInstanceOf(AuthInvalidCredentialsError);
    });
  });
});
