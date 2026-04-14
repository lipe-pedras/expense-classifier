import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import {
  AppError,
  AuthInvalidCredentialsError,
  AuthTokenExpiredError,
  AuthTokenInvalidError,
  AuthRefreshTokenInvalidError,
  UserNotFoundError,
  UserEmailTakenError,
  UserUsernameTakenError,
  DocumentNotFoundError,
  DocumentUploadFailedError,
  DocumentUnsupportedTypeError,
  DocumentTooLargeError,
  ExpenseNotFoundError,
  CategoryNotFoundError,
  CategorySystemDeleteError,
  CategorySlugTakenError,
  InternalError,
} from '../../src/errors/AppError.js';
import { registerErrorHandler } from '../../src/errors/errorHandler.js';

describe('AppError', () => {
  describe('error catalogue', () => {
    const cases: Array<[new () => AppError, string, number]> = [
      [AuthInvalidCredentialsError, 'AUTH_INVALID_CREDENTIALS', 401],
      [AuthTokenExpiredError, 'AUTH_TOKEN_EXPIRED', 401],
      [AuthTokenInvalidError, 'AUTH_TOKEN_INVALID', 401],
      [AuthRefreshTokenInvalidError, 'AUTH_REFRESH_TOKEN_INVALID', 401],
      [UserNotFoundError, 'USER_NOT_FOUND', 404],
      [UserEmailTakenError, 'USER_EMAIL_TAKEN', 409],
      [UserUsernameTakenError, 'USER_USERNAME_TAKEN', 409],
      [DocumentNotFoundError, 'DOCUMENT_NOT_FOUND', 404],
      [DocumentUploadFailedError, 'DOCUMENT_UPLOAD_FAILED', 500],
      [DocumentUnsupportedTypeError, 'DOCUMENT_UNSUPPORTED_TYPE', 415],
      [DocumentTooLargeError, 'DOCUMENT_TOO_LARGE', 413],
      [ExpenseNotFoundError, 'EXPENSE_NOT_FOUND', 404],
      [CategoryNotFoundError, 'CATEGORY_NOT_FOUND', 404],
      [CategorySystemDeleteError, 'CATEGORY_SYSTEM_DELETE', 403],
      [CategorySlugTakenError, 'CATEGORY_SLUG_TAKEN', 409],
      [InternalError, 'INTERNAL_ERROR', 500],
    ];

    it.each(cases)('%o has correct code and statusCode', (Ctor, code, status) => {
      const err = new Ctor();
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe(code);
      expect(err.statusCode).toBe(status);
      expect(typeof err.message).toBe('string');
      expect(err.message.length).toBeGreaterThan(0);
    });

    it('toJSON serialises as { error: { code, message } }', () => {
      const err = new UserNotFoundError('nope');
      expect(err.toJSON()).toEqual({
        error: { code: 'USER_NOT_FOUND', message: 'nope' },
      });
    });
  });

  describe('global error handler', () => {
    async function buildApp() {
      const app = Fastify();
      registerErrorHandler(app);
      app.get('/app-error', async () => {
        throw new DocumentNotFoundError();
      });
      app.get('/unknown', async () => {
        throw new Error('boom');
      });
      app.get('/validated', {
        schema: {
          querystring: {
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' } },
          },
        },
        handler: async () => ({ ok: true }),
      });
      await app.ready();
      return app;
    }

    it('serialises AppError with correct status and shape', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/app-error' });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
      await app.close();
    });

    it('maps unknown errors to INTERNAL_ERROR 500', async () => {
      const app = await buildApp();
      // Silence error log noise from the intentional throw
      app.log.level = 'silent';
      const res = await app.inject({ method: 'GET', url: '/unknown' });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
      await app.close();
    });

    it('returns 400 VALIDATION_ERROR for schema failures', async () => {
      const app = await buildApp();
      const res = await app.inject({ method: 'GET', url: '/validated' });
      expect(res.statusCode).toBe(400);
      const body = res.json() as { error: { code: string } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
      await app.close();
    });
  });
});
