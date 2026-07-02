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


describe('GET /api/users/me', () => {
  it('returns the authenticated user without passwordHash', async () => {
    const { user, accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(user.id);
    expect(body.email).toBe(user.email);
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without auth header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with malformed token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { Authorization: 'Bearer garbage' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('PUT /api/users/me', () => {
  it('updates username', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/me',
      headers: authHeader(accessToken),
      payload: { username: 'updatedname' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe('updatedname');
  });

  it('updates email', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/me',
      headers: authHeader(accessToken),
      payload: { email: 'updated@example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('updated@example.com');
  });

  it('returns 409 when email is taken by another user', async () => {
    const { accessToken } = await registerAndLogin(app);
    const other = await registerAndLogin(app);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/me',
      headers: authHeader(accessToken),
      payload: { email: other.user.email },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('USER_EMAIL_TAKEN');
  });

  it('returns 409 when username is taken by another user', async () => {
    const { accessToken } = await registerAndLogin(app);
    const other = await registerAndLogin(app);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/me',
      headers: authHeader(accessToken),
      payload: { username: other.user.username },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('USER_USERNAME_TAKEN');
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/users/me', payload: {} });
    expect(res.statusCode).toBe(401);
  });
});

describe('DELETE /api/users/me', () => {
  it('deletes the user and their data when password and username match', async () => {
    const { user, accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/me',
      headers: authHeader(accessToken),
      payload: { password: 'password123', username: user.username },
    });

    expect(res.statusCode).toBe(204);

    const dbUser = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser).toBeNull();
  });

  it('returns 401 and keeps the account when the password is wrong', async () => {
    const { user, accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/me',
      headers: authHeader(accessToken),
      payload: { password: 'wrong-password', username: user.username },
    });

    expect(res.statusCode).toBe(401);
    const dbUser = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser).not.toBeNull();
  });

  it('returns 400 when the username confirmation does not match', async () => {
    const { user, accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/me',
      headers: authHeader(accessToken),
      payload: { password: 'password123', username: `${user.username}-wrong` },
    });

    expect(res.statusCode).toBe(400);
    const dbUser = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser).not.toBeNull();
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/users/me',
      payload: { password: 'password123', username: 'someone' },
    });
    expect(res.statusCode).toBe(401);
  });
});
