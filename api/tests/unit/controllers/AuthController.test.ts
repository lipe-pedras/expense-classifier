import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, makeMockServices, type AppServices } from '../../helpers/testApp.js';
import {
  UserEmailTakenError,
  AuthInvalidCredentialsError,
} from '../../../src/errors/AppError.js';

const authResult = {
  user: { id: 'user-1', username: 'alice', email: 'alice@example.com', createdAt: new Date() },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

describe('AuthController', () => {
  let services: AppServices;
  let app: FastifyInstance;

  beforeEach(async () => {
    services = makeMockServices();
    app = await buildTestApp(services);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should return 201 with auth result on success', async () => {
      (services.authService.register as any).mockResolvedValue(authResult);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        body: { username: 'alice', email: 'alice@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.accessToken).toBe('access-token');
      expect(services.authService.register).toHaveBeenCalledWith({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
      });
    });

    it('should return 409 when the email is already taken', async () => {
      (services.authService.register as any).mockRejectedValue(new UserEmailTakenError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        body: { username: 'alice', email: 'alice@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('USER_EMAIL_TAKEN');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 200 with auth result on success', async () => {
      (services.authService.login as any).mockResolvedValue(authResult);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        body: { email: 'alice@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().refreshToken).toBe('refresh-token');
    });

    it('should return 401 for invalid credentials', async () => {
      (services.authService.login as any).mockRejectedValue(new AuthInvalidCredentialsError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        body: { email: 'x@x.com', password: 'wrong' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 200 with new tokens', async () => {
      (services.authService.refresh as any).mockResolvedValue(authResult);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        body: { refreshToken: 'old-refresh' },
      });

      expect(res.statusCode).toBe(200);
      expect(services.authService.refresh).toHaveBeenCalledWith('old-refresh');
    });
  });
});
