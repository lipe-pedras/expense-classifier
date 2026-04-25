import { describe, it, expect, beforeAll, afterAll, beforeEach, onTestFailed } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildE2eApp, type E2eApp } from './helpers/buildE2eApp.js';
import { testPrisma } from '../helpers/dbClient.js';
import {
  registerAndLogin,
  authHeader,
  uploadTestFile,
  waitForDocumentDone,
  buildMultipartBody,
  TINY_PNG,
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


describe('POST /api/documents', () => {
  it('uploads a PNG and creates a PENDING document', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);

    expect(doc.status).toBe('PENDING');
    expect(doc.fileType).toBe('IMAGE');
    expect(doc.expenseCount).toBe(0);

    const dbDoc = await testPrisma.document.findUnique({ where: { id: doc.id } });
    expect(dbDoc).not.toBeNull();
  });

  it('mock worker processes the job — document reaches DONE with 1 expense', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);

    await waitForDocumentDone(app, accessToken, doc.id);

    const dbDoc = await testPrisma.document.findUnique({ where: { id: doc.id } });
    expect(dbDoc!.status).toBe('DONE');
    expect(dbDoc!.expenseCount).toBe(1);

    const expenses = await testPrisma.expense.findMany({ where: { documentId: doc.id } });
    expect(expenses).toHaveLength(1);
    expect(expenses[0].amount).toBe(42);
  });

  it('returns 400 when no multipart body is sent', async () => {
    const { accessToken } = await registerAndLogin(app);

    // Non-multipart request — req.file() returns null, triggering VALIDATION_ERROR
    const res = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: { ...authHeader(accessToken), 'content-type': 'application/json' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 415 for unsupported MIME type', async () => {
    const { accessToken } = await registerAndLogin(app);
    const { body, contentType } = buildMultipartBody('file', 'file.txt', Buffer.from('hello'), 'text/plain');

    const res = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: { ...authHeader(accessToken), 'content-type': contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('DOCUMENT_UNSUPPORTED_TYPE');
  });

  it('returns 401 without auth', async () => {
    const { body, contentType } = buildMultipartBody('file', 'test.png', TINY_PNG, 'image/png');
    const res = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: { 'content-type': contentType },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/documents', () => {
  it('returns list of user documents', async () => {
    const { accessToken } = await registerAndLogin(app);
    await uploadTestFile(app, accessToken);
    await uploadTestFile(app, accessToken);

    const res = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    const docs = res.json() as unknown[];
    expect(docs).toHaveLength(2);
  });

  it('does not return another user\'s documents', async () => {
    const { accessToken: tok1 } = await registerAndLogin(app);
    const { accessToken: tok2 } = await registerAndLogin(app);
    await uploadTestFile(app, tok2);

    const res = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: authHeader(tok1),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(0);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/documents' });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /api/documents/:id', () => {
  it('returns a specific document', async () => {
    const { accessToken } = await registerAndLogin(app);
    const uploaded = await uploadTestFile(app, accessToken);

    const res = await app.inject({
      method: 'GET',
      url: `/api/documents/${uploaded.id}`,
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(uploaded.id);
  });

  it('returns 404 for another user\'s document', async () => {
    const { accessToken: tok1 } = await registerAndLogin(app);
    const { accessToken: tok2 } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, tok2);

    const res = await app.inject({
      method: 'GET',
      url: `/api/documents/${doc.id}`,
      headers: authHeader(tok1),
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for non-existent id', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'GET',
      url: '/api/documents/nonexistent',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/documents/:id', () => {
  it('deletes the document and removes it from the DB', async () => {
    const { accessToken } = await registerAndLogin(app);
    const doc = await uploadTestFile(app, accessToken);

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/documents/${doc.id}`,
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(204);
    const dbDoc = await testPrisma.document.findUnique({ where: { id: doc.id } });
    expect(dbDoc).toBeNull();
  });

  it('returns 404 for non-existent document', async () => {
    const { accessToken } = await registerAndLogin(app);

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/documents/nonexistent',
      headers: authHeader(accessToken),
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/documents/someid' });
    expect(res.statusCode).toBe(401);
  });
});
