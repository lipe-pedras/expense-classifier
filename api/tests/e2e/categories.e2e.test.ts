import { describe, it, expect, beforeAll, afterAll, beforeEach, onTestFailed } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildE2eApp, type E2eApp } from './helpers/buildE2eApp.js';
import { testPrisma } from '../helpers/dbClient.js';
import { registerAndLogin, authHeader } from './helpers/e2eFactories.js';

let ctx: E2eApp;
let app: FastifyInstance;

beforeAll(async () => {
  ctx = await buildE2eApp();
  app = ctx.app;
  await app.ready();
});

afterAll(async () => {
  await ctx.mockWorker.close();
  await ctx.queueEvents.close();
  await ctx.redis.quit();
  await app.close();
  await testPrisma.$disconnect();
});

beforeEach(async () => {
  await ctx.resetBetweenTests();
  ctx.clearExchangeLogs();
  onTestFailed(() => {
    console.error('\n--- E2E Exchange Log ---');
    console.error(JSON.stringify(ctx.getExchangeLogs(), null, 2));
  });
});


describe('GET /api/categories', () => {
  it('returns system categories seeded at registration', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/categories',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const categories = res.json() as Array<{ slug: string; isSystem: boolean }>;
    expect(categories.length).toBeGreaterThanOrEqual(6);
    const systemSlugs = categories.filter((c) => c.isSystem).map((c) => c.slug);
    expect(systemSlugs).toContain('rent');
    expect(systemSlugs).toContain('other');
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/categories', () => {
  it('creates a user category', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(accessToken),
      payload: { name: 'Travel' },
    });

    expect(res.statusCode).toBe(201);
    const cat = res.json();
    expect(cat.slug).toBe('travel');
    expect(cat.isSystem).toBe(false);
  });

  it('derives the slug from a multi-word name', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(accessToken),
      payload: { name: 'Gym & Fitness' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().slug).toBe('gym-fitness');
  });

  it('returns 400 when the name is missing', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(accessToken),
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 409 on duplicate name for the same user', async () => {
    const { accessToken } = await registerAndLogin(app);
    await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(accessToken),
      payload: { name: 'Travel' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(accessToken),
      payload: { name: 'Travel' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CATEGORY_NAME_TAKEN');
  });

  it('allows the same name for different users', async () => {
    const { accessToken: tok1 } = await registerAndLogin(app);
    const { accessToken: tok2 } = await registerAndLogin(app);

    await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(tok1),
      payload: { name: 'Travel' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(tok2),
      payload: { name: 'Travel' },
    });

    expect(res.statusCode).toBe(201);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('PUT /api/categories/:id', () => {
  it('renames a user-created category and re-derives the slug', async () => {
    const { accessToken } = await registerAndLogin(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(accessToken),
      payload: { name: 'Travel' },
    });
    const { id } = created.json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${id}`,
      headers: authHeader(accessToken),
      payload: { name: 'Business Travel' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Business Travel');
    expect(res.json().slug).toBe('business-travel');
  });

  it('returns 403 when renaming a system category', async () => {
    const { accessToken, user } = await registerAndLogin(app);
    const systemCat = await testPrisma.category.findFirst({ where: { userId: user.id, isSystem: true } });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${systemCat!.id}`,
      headers: authHeader(accessToken),
      payload: { name: 'Renamed' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CATEGORY_SYSTEM_MODIFY');
  });

  it('returns 409 when renaming to a name already used by the same user', async () => {
    const { accessToken } = await registerAndLogin(app);
    await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(accessToken),
      payload: { name: 'Travel' },
    });
    const other = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(accessToken),
      payload: { name: 'Food' },
    });
    const { id } = other.json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${id}`,
      headers: authHeader(accessToken),
      payload: { name: 'Travel' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CATEGORY_NAME_TAKEN');
  });

  it('returns 404 for another user\'s category', async () => {
    const { accessToken: tok1 } = await registerAndLogin(app);
    const { accessToken: tok2 } = await registerAndLogin(app);
    const created = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(tok2),
      payload: { name: 'Private' },
    });
    const { id } = created.json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/categories/${id}`,
      headers: authHeader(tok1),
      payload: { name: 'Hijacked' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/categories/someid',
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('deletes a user-created category', async () => {
    const { accessToken } = await registerAndLogin(app);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: authHeader(accessToken),
      payload: { name: 'Travel', slug: 'travel' },
    });
    const { id } = createRes.json();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${id}`,
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(204);
    const dbCat = await testPrisma.category.findUnique({ where: { id } });
    expect(dbCat).toBeNull();
  });

  it('returns 403 when trying to delete a system category', async () => {
    const { accessToken, user } = await registerAndLogin(app);
    const systemCat = await testPrisma.category.findFirst({ where: { userId: user.id, isSystem: true } });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${systemCat!.id}`,
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('CATEGORY_SYSTEM_DELETE');
  });

  it('returns 404 for non-existent category', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/categories/nonexistent-id',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when accessing another user\'s category', async () => {
    const { accessToken: tok1 } = await registerAndLogin(app);
    const { accessToken: tok2, user: user2 } = await registerAndLogin(app);

    const cat = await testPrisma.category.findFirst({ where: { userId: user2.id, isSystem: false } });
    if (!cat) {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/categories',
        headers: authHeader(tok2),
        payload: { name: 'Private', slug: 'private' },
      });
      const { id } = createRes.json();

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/categories/${id}`,
        headers: authHeader(tok1),
      });
      expect(res.statusCode).toBe(404);
    } else {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/categories/${cat.id}`,
        headers: authHeader(tok1),
      });
      expect(res.statusCode).toBe(404);
    }
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/categories/someid' });
    expect(res.statusCode).toBe(401);
  });
});
