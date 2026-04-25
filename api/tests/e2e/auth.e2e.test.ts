import { describe, it, expect, beforeAll, afterAll, beforeEach, onTestFailed } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildE2eApp, type E2eApp } from './helpers/buildE2eApp.js';
import { testPrisma } from '../helpers/dbClient.js';

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


const validUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
};

describe('POST /api/auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.username).toBe(validUser.username);
    expect(body.user.email).toBe(validUser.email);
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');

    const dbUser = await testPrisma.user.findUnique({ where: { email: validUser.email } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.passwordHash).not.toBe(validUser.password);
  });

  it('seeds system categories on registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });
    const { user } = res.json();
    const cats = await testPrisma.category.findMany({ where: { userId: user.id, isSystem: true } });
    expect(cats.length).toBeGreaterThanOrEqual(6);
  });

  it('returns 409 on duplicate email', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: validUser });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...validUser, username: 'differentuser' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('USER_EMAIL_TAKEN');
  });

  it('returns 409 on duplicate username', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: validUser });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...validUser, email: 'other@example.com' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('USER_USERNAME_TAKEN');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await app.inject({ method: 'POST', url: '/api/auth/register', payload: validUser });
  });

  it('returns tokens on valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: validUser.email, password: validUser.password },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.user.email).toBe(validUser.email);
  });

  it('returns 401 on wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: validUser.email, password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('returns 401 on unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

describe('POST /api/auth/refresh', () => {
  it('issues new tokens from a valid refresh token', async () => {
    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: validUser,
    });
    const { refreshToken } = reg.json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
  });

  it('returns 401 on garbage token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'not.a.valid.token' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REFRESH_TOKEN_INVALID');
  });
});
