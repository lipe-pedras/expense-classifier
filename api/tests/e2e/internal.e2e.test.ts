import { describe, it, expect, beforeAll, afterAll, beforeEach, onTestFailed } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildE2eApp, E2E_INTERNAL_TOKEN, type E2eApp } from './helpers/buildE2eApp.js';
import { testPrisma } from '../helpers/dbClient.js';
import { registerAndLogin, uploadTestFile, internalAuthHeader, waitForDocumentDone } from './helpers/e2eFactories.js';

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


describe('POST /internal/results', () => {
  it('creates an expense and increments document expenseCount', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);

    const res = await app.inject({
      method: 'POST',
      url: '/internal/results',
      headers: internalAuthHeader(),
      payload: {
        documentId: doc.id,
        segmentIndex: 0,
        categorySlug: 'other',
        vendor: 'Acme Corp',
        amount: 150.0,
        currency: 'BRL',
        expenseDate: new Date().toISOString(),
        confidence: 0.95,
        rawText: 'Invoice from Acme Corp, R$150,00',
      },
    });

    expect(res.statusCode).toBe(201);
    const expense = res.json();
    expect(expense.amount).toBe(150);
    expect(expense.vendor).toBe('Acme Corp');
    expect(expense.documentId).toBe(doc.id);

    const dbDoc = await testPrisma.document.findUnique({ where: { id: doc.id } });
    expect(dbDoc!.expenseCount).toBe(1);
  });

  it('accepts null vendor', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);

    const res = await app.inject({
      method: 'POST',
      url: '/internal/results',
      headers: internalAuthHeader(),
      payload: {
        documentId: doc.id,
        segmentIndex: 0,
        categorySlug: 'other',
        vendor: null,
        amount: 50.0,
        currency: 'BRL',
        expenseDate: new Date().toISOString(),
        confidence: 0.8,
        rawText: 'Unknown vendor expense',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().vendor).toBeNull();
  });

  it('returns 401 with wrong internal token', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);

    const res = await app.inject({
      method: 'POST',
      url: '/internal/results',
      headers: { Authorization: 'Bearer wrong_token' },
      payload: {
        documentId: doc.id,
        segmentIndex: 0,
        categorySlug: 'other',
        vendor: null,
        amount: 10,
        currency: 'BRL',
        expenseDate: new Date().toISOString(),
        confidence: 0.5,
        rawText: 'text',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with no auth header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/results',
      payload: {
        documentId: 'any',
        segmentIndex: 0,
        categorySlug: 'other',
        vendor: null,
        amount: 10,
        currency: 'BRL',
        expenseDate: new Date().toISOString(),
        confidence: 0.5,
        rawText: 'text',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for non-existent documentId', async () => {
    await registerAndLogin(app);

    const res = await app.inject({
      method: 'POST',
      url: '/internal/results',
      headers: internalAuthHeader(),
      payload: {
        documentId: 'nonexistent-document-id',
        segmentIndex: 0,
        categorySlug: 'other',
        vendor: null,
        amount: 10,
        currency: 'BRL',
        expenseDate: new Date().toISOString(),
        confidence: 0.5,
        rawText: 'text',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('DOCUMENT_NOT_FOUND');
  });

  it('returns 404 for non-existent categorySlug', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);

    const res = await app.inject({
      method: 'POST',
      url: '/internal/results',
      headers: internalAuthHeader(),
      payload: {
        documentId: doc.id,
        segmentIndex: 0,
        categorySlug: 'does-not-exist',
        vendor: null,
        amount: 10,
        currency: 'BRL',
        expenseDate: new Date().toISOString(),
        confidence: 0.5,
        rawText: 'text',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('CATEGORY_NOT_FOUND');
  });

  it('supports multiple segments for the same document', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);

    // Wait for the mock worker to process the job (creates 1 expense for segmentIndex 0)
    await waitForDocumentDone(app, accessToken, doc.id);

    const base = {
      documentId: doc.id,
      categorySlug: 'other',
      vendor: null,
      amount: 10,
      currency: 'BRL',
      expenseDate: new Date().toISOString(),
      confidence: 0.9,
      rawText: 'text',
    };

    // Submit 2 additional segments on top of the 1 the mock worker already created
    await app.inject({
      method: 'POST',
      url: '/internal/results',
      headers: internalAuthHeader(),
      payload: { ...base, segmentIndex: 1 },
    });
    await app.inject({
      method: 'POST',
      url: '/internal/results',
      headers: internalAuthHeader(),
      payload: { ...base, segmentIndex: 2 },
    });

    const dbDoc = await testPrisma.document.findUnique({ where: { id: doc.id } });
    expect(dbDoc!.expenseCount).toBe(3);
  });
});
