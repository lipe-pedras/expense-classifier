import { describe, it, expect, beforeAll, afterAll, beforeEach, onTestFailed } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildE2eApp, type E2eApp } from './helpers/buildE2eApp.js';
import { testPrisma } from '../helpers/dbClient.js';
import {
  registerAndLogin,
  authHeader,
  uploadTestFile,
  waitForDocumentDone,
} from './helpers/e2eFactories.js';

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


const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK zip magic

describe('GET /api/expenses/export', () => {
  it('returns a valid XLSX file when expenses exist', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);
    await waitForDocumentDone(app, accessToken, doc.id);

    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses/export',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('expenses.xlsx');

    const buf = res.rawPayload;
    expect(buf.slice(0, 4)).toEqual(XLSX_MAGIC);
  });

  it('returns a valid XLSX even when there are no expenses', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/expenses/export',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const buf = res.rawPayload;
    expect(buf.slice(0, 4)).toEqual(XLSX_MAGIC);
  });

  it('filters by categorySlug', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);
    await waitForDocumentDone(app, accessToken, doc.id);

    const matchRes = await app.inject({
      method: 'GET',
      url: '/api/expenses/export?categorySlug=other',
      headers: authHeader(accessToken),
    });
    expect(matchRes.statusCode).toBe(200);
    expect(matchRes.rawPayload.slice(0, 4)).toEqual(XLSX_MAGIC);

    const noMatchRes = await app.inject({
      method: 'GET',
      url: '/api/expenses/export?categorySlug=rent',
      headers: authHeader(accessToken),
    });
    expect(noMatchRes.statusCode).toBe(200);
    expect(noMatchRes.rawPayload.slice(0, 4)).toEqual(XLSX_MAGIC);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/expenses/export' });
    expect(res.statusCode).toBe(401);
  });
});
