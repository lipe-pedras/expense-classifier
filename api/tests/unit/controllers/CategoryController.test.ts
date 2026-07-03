import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, makeMockServices, type AppServices } from '../../helpers/testApp.js';
import {
  CategoryNameTakenError,
  CategoryNotFoundError,
  CategorySystemDeleteError,
  CategorySystemModifyError,
} from '../../../src/errors/AppError.js';

const AUTH = { authorization: 'Bearer valid-token' };

const category = {
  id: 'cat-1',
  userId: 'user-1',
  name: 'Rent',
  slug: 'rent',
  isSystem: true,
};

describe('CategoryController', () => {
  let services: AppServices;
  let app: FastifyInstance;

  beforeEach(async () => {
    services = makeMockServices();
    app = await buildTestApp(services);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/categories', () => {
    it('should return the list of categories', async () => {
      (services.categoryService.list as any).mockResolvedValue([category]);

      const res = await app.inject({ method: 'GET', url: '/api/categories', headers: AUTH });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect(services.categoryService.list).toHaveBeenCalledWith('user-1');
    });

    it('should return 401 without a token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/categories' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/categories', () => {
    it('should return 201 with the created category (name only)', async () => {
      const newCat = { ...category, id: 'cat-2', name: 'Gym', slug: 'gym', isSystem: false };
      (services.categoryService.create as any).mockResolvedValue(newCat);

      const res = await app.inject({
        method: 'POST',
        url: '/api/categories',
        headers: AUTH,
        body: { name: 'Gym' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().slug).toBe('gym');
      expect(services.categoryService.create).toHaveBeenCalledWith('user-1', { name: 'Gym' });
    });

    it('should return 400 when the name is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/categories',
        headers: AUTH,
        body: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 409 when the name is already taken', async () => {
      (services.categoryService.create as any).mockRejectedValue(new CategoryNameTakenError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/categories',
        headers: AUTH,
        body: { name: 'Rent' },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('PUT /api/categories/:id', () => {
    it('should return 200 with the renamed category', async () => {
      const renamed = { ...category, id: 'cat-2', name: 'Fitness', slug: 'fitness', isSystem: false };
      (services.categoryService.update as any).mockResolvedValue(renamed);

      const res = await app.inject({
        method: 'PUT',
        url: '/api/categories/cat-2',
        headers: AUTH,
        body: { name: 'Fitness' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('Fitness');
      expect(services.categoryService.update).toHaveBeenCalledWith('user-1', 'cat-2', { name: 'Fitness' });
    });

    it('should return 400 when the name is missing', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/categories/cat-2', headers: AUTH, body: {} });
      expect(res.statusCode).toBe(400);
    });

    it('should return 403 when renaming a system category', async () => {
      (services.categoryService.update as any).mockRejectedValue(new CategorySystemModifyError());

      const res = await app.inject({
        method: 'PUT',
        url: '/api/categories/cat-1',
        headers: AUTH,
        body: { name: 'X' },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 when the category does not exist', async () => {
      (services.categoryService.update as any).mockRejectedValue(new CategoryNotFoundError());

      const res = await app.inject({
        method: 'PUT',
        url: '/api/categories/missing',
        headers: AUTH,
        body: { name: 'X' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 409 when the new name is taken', async () => {
      (services.categoryService.update as any).mockRejectedValue(new CategoryNameTakenError());

      const res = await app.inject({
        method: 'PUT',
        url: '/api/categories/cat-2',
        headers: AUTH,
        body: { name: 'Rent' },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('should return 204 on success', async () => {
      (services.categoryService.delete as any).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/categories/cat-2',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(204);
      expect(services.categoryService.delete).toHaveBeenCalledWith('user-1', 'cat-2');
    });

    it('should return 403 when deleting a system category', async () => {
      (services.categoryService.delete as any).mockRejectedValue(new CategorySystemDeleteError());

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/categories/cat-1',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 when the category does not exist', async () => {
      (services.categoryService.delete as any).mockRejectedValue(new CategoryNotFoundError());

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/categories/missing',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
