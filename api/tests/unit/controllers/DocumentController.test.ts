import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import FormData from 'form-data';
import { buildTestApp, makeMockServices, type AppServices } from '../../helpers/testApp.js';
import {
  DocumentNotFoundError,
  DocumentUnsupportedTypeError,
  DocumentTooLargeError,
} from '../../../src/errors/AppError.js';

const AUTH = { authorization: 'Bearer valid-token' };

const document = {
  id: 'doc-1',
  userId: 'user-1',
  originalName: 'bill.pdf',
  filePath: '/uploads/abc.pdf',
  fileType: 'PDF',
  status: 'PENDING',
  expenseCount: 0,
  uploadedAt: new Date().toISOString(),
};

describe('DocumentController', () => {
  let services: AppServices;
  let app: FastifyInstance;

  beforeEach(async () => {
    services = makeMockServices();
    app = await buildTestApp(services);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/documents', () => {
    it('should upload a file and return 201', async () => {
      (services.documentService.upload as any).mockResolvedValue(document);

      const form = new FormData();
      form.append('file', Buffer.from('pdf-content'), { filename: 'bill.pdf', contentType: 'application/pdf' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { ...AUTH, ...form.getHeaders() },
        body: form.getBuffer(),
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().id).toBe('doc-1');
      expect(services.documentService.upload).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ originalName: 'bill.pdf', mimeType: 'application/pdf' }),
      );
    });

    it('should return 415 for unsupported file types', async () => {
      (services.documentService.upload as any).mockRejectedValue(
        new DocumentUnsupportedTypeError(),
      );

      const form = new FormData();
      form.append('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { ...AUTH, ...form.getHeaders() },
        body: form.getBuffer(),
      });

      expect(res.statusCode).toBe(415);
    });

    it('should return 413 when the file is too large', async () => {
      (services.documentService.upload as any).mockRejectedValue(new DocumentTooLargeError());

      const form = new FormData();
      form.append('file', Buffer.alloc(5), { filename: 'big.pdf', contentType: 'application/pdf' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { ...AUTH, ...form.getHeaders() },
        body: form.getBuffer(),
      });

      expect(res.statusCode).toBe(413);
    });
  });

  describe('GET /api/documents', () => {
    it('should return the list of documents', async () => {
      (services.documentService.list as any).mockResolvedValue([document]);

      const res = await app.inject({ method: 'GET', url: '/api/documents', headers: AUTH });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });
  });

  describe('GET /api/documents/:id', () => {
    it('should return the document', async () => {
      (services.documentService.getById as any).mockResolvedValue(document);

      const res = await app.inject({
        method: 'GET',
        url: '/api/documents/doc-1',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe('doc-1');
    });

    it('should return 404 for another user\'s document', async () => {
      (services.documentService.getById as any).mockRejectedValue(new DocumentNotFoundError());

      const res = await app.inject({
        method: 'GET',
        url: '/api/documents/doc-other',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/documents/:id', () => {
    it('should rename and return 200 with the document', async () => {
      (services.documentService.rename as any).mockResolvedValue({ ...document, originalName: 'renamed.pdf' });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/documents/doc-1',
        headers: AUTH,
        payload: { originalName: 'renamed.pdf' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().originalName).toBe('renamed.pdf');
      expect(services.documentService.rename).toHaveBeenCalledWith(expect.any(String), 'doc-1', 'renamed.pdf');
    });

    it('should return 400 when originalName is missing', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/documents/doc-1', headers: AUTH, payload: {} });
      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for another user\'s document', async () => {
      (services.documentService.rename as any).mockRejectedValue(new DocumentNotFoundError());

      const res = await app.inject({
        method: 'PUT',
        url: '/api/documents/doc-other',
        headers: AUTH,
        payload: { originalName: 'x.pdf' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should return 204 on success', async () => {
      (services.documentService.delete as any).mockResolvedValue(undefined);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/documents/doc-1',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(204);
    });

    it('should return 404 for another user\'s document', async () => {
      (services.documentService.delete as any).mockRejectedValue(new DocumentNotFoundError());

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/documents/doc-other',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
