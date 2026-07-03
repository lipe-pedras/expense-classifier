import { vi } from 'vitest';
import { buildApp, type AppServices } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

/**
 * Builds a Fastify instance with fully-mocked services for controller unit
 * tests. Callers can override individual service methods via the returned
 * `services` object before injecting requests.
 */
export function makeMockServices(): AppServices {
  return {
    authService: {
      register: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
    } as unknown as AppServices['authService'],

    userService: {
      getById: vi.fn(),
      update: vi.fn(),
      changePassword: vi.fn(),
      delete: vi.fn(),
    } as unknown as AppServices['userService'],

    categoryService: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    } as unknown as AppServices['categoryService'],

    documentService: {
      upload: vi.fn(),
      list: vi.fn(),
      getById: vi.fn(),
      rename: vi.fn(),
      delete: vi.fn(),
      recordInternalResult: vi.fn(),
    } as unknown as AppServices['documentService'],

    expenseService: {
      list: vi.fn(),
      create: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getDashboard: vi.fn(),
    } as unknown as AppServices['expenseService'],

    exportService: {
      exportExpenses: vi.fn(),
    } as unknown as AppServices['exportService'],

    jwtService: {
      signAccessToken: vi.fn().mockReturnValue('access-token'),
      signRefreshToken: vi.fn().mockReturnValue('refresh-token'),
      // By default, all tokens are valid for user-1
      verifyAccessToken: vi.fn().mockReturnValue({ userId: 'user-1' }),
      verifyRefreshToken: vi.fn(),
    } as unknown as AppServices['jwtService'],

    wsNotifier: {
      register: vi.fn(),
      unregister: vi.fn(),
      onCompleted: vi.fn(),
      onFailed: vi.fn(),
    } as unknown as AppServices['wsNotifier'],

    internalServiceToken: 'test-internal-token',
    maxFileSizeBytes: 10 * 1024 * 1024,
  };
}

export async function buildTestApp(services: AppServices): Promise<FastifyInstance> {
  process.env.SWAGGER_ENABLED = 'false';
  const app = await buildApp(services);
  // Silence logger in tests
  app.log.level = 'silent';
  return app;
}
