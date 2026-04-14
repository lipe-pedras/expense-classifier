import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import { testPrisma, resetDatabase } from '../../helpers/dbClient.js';
import { UserRepository } from '../../../src/repositories/UserRepository.js';
import {
  AuthService,
  BcryptHasher,
} from '../../../src/services/AuthService.js';
import { JwtService } from '../../../src/services/JwtService.js';
import {
  AuthInvalidCredentialsError,
  UserEmailTakenError,
  UserUsernameTakenError,
} from '../../../src/errors/AppError.js';
import { SYSTEM_CATEGORIES } from '../../../src/config.js';

describe('AuthService (integration)', () => {
  const userRepo = new UserRepository(testPrisma);
  const jwt = new JwtService('access-secret', 'refresh-secret', 900, 604800);
  const hasher = new BcryptHasher(4);
  const service = new AuthService(userRepo, jwt, hasher);

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  describe('register', () => {
    it('should create a user, persist a bcrypt hash, and seed all system categories', async () => {
      const result = await service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(result.user.email).toBe('alice@example.com');
      expect(result.user.username).toBe('alice');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();

      const row = await testPrisma.user.findUnique({
        where: { email: 'alice@example.com' },
      });
      expect(row).not.toBeNull();
      expect(row!.passwordHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', row!.passwordHash)).toBe(true);

      const categories = await testPrisma.category.findMany({
        where: { userId: row!.id },
      });
      expect(categories).toHaveLength(SYSTEM_CATEGORIES.length);
      expect(categories.every((c) => c.isSystem)).toBe(true);
      const slugs = categories.map((c) => c.slug).sort();
      expect(slugs).toEqual(SYSTEM_CATEGORIES.map((c) => c.slug).sort());
    });

    it('should roll back the user when category creation fails (atomic transaction)', async () => {
      await testPrisma.user.create({
        data: { username: 'bob', email: 'bob@example.com', passwordHash: 'x' },
      });
      await expect(
        service.register({
          username: 'bob',
          email: 'new@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UserUsernameTakenError);

      const count = await testPrisma.user.count({
        where: { email: 'new@example.com' },
      });
      expect(count).toBe(0);
    });

    it('should reject duplicate emails', async () => {
      await service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });
      await expect(
        service.register({
          username: 'alice2',
          email: 'alice@example.com',
          password: 'password123',
        }),
      ).rejects.toBeInstanceOf(UserEmailTakenError);
    });
  });

  describe('login', () => {
    it('should authenticate with the correct password', async () => {
      await service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });

      const result = await service.login({
        email: 'alice@example.com',
        password: 'password123',
      });
      expect(result.accessToken).toBeTruthy();
    });

    it('should throw AuthInvalidCredentialsError for a wrong password', async () => {
      await service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(AuthInvalidCredentialsError);
    });
  });

  describe('refresh', () => {
    it('should issue new tokens for a valid refresh token', async () => {
      const reg = await service.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });

      const result = await service.refresh(reg.refreshToken);
      expect(result.accessToken).toBeTruthy();
      expect(result.user.email).toBe('alice@example.com');
    });
  });
});
