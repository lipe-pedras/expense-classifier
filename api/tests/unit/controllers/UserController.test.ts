import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, makeMockServices, type AppServices } from '../../helpers/testApp.js';
import { UserNotFoundError } from '../../../src/errors/AppError.js';

const userView = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  createdAt: new Date().toISOString(),
};

const AUTH = { authorization: 'Bearer valid-token' };

describe('UserController', () => {
  let services: AppServices;
  let app: FastifyInstance;

  beforeEach(async () => {
    services = makeMockServices();
    app = await buildTestApp(services);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/users/me', () => {
    it('should return the current user', async () => {
      (services.userService.getById as any).mockResolvedValue(userView);

      const res = await app.inject({ method: 'GET', url: '/api/users/me', headers: AUTH });

      expect(res.statusCode).toBe(200);
      expect(res.json().username).toBe('alice');
      expect(services.userService.getById).toHaveBeenCalledWith('user-1');
    });

    it('should return 401 without a token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/users/me' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/users/me', () => {
    it('should return updated user', async () => {
      const updated = { ...userView, email: 'new@example.com' };
      (services.userService.update as any).mockResolvedValue(updated);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/me',
        headers: AUTH,
        body: { email: 'new@example.com' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().email).toBe('new@example.com');
    });
  });

  describe('DELETE /api/users/me', () => {
    it('should return 204 on success', async () => {
      (services.userService.delete as any).mockResolvedValue(undefined);

      const res = await app.inject({ method: 'DELETE', url: '/api/users/me', headers: AUTH });

      expect(res.statusCode).toBe(204);
    });

    it('should return 404 when the user is gone', async () => {
      (services.userService.delete as any).mockRejectedValue(new UserNotFoundError());

      const res = await app.inject({ method: 'DELETE', url: '/api/users/me', headers: AUTH });

      expect(res.statusCode).toBe(404);
    });
  });
});
