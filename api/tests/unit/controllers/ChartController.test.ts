import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, makeMockServices, type AppServices } from '../../helpers/testApp.js';
import { ChartUnsupportedError, ChartGenerationFailedError } from '../../../src/errors/AppError.js';

const AUTH = { authorization: 'Bearer valid-token' };

describe('ChartController', () => {
  let services: AppServices;
  let app: FastifyInstance;

  beforeEach(async () => {
    services = makeMockServices();
    app = await buildTestApp(services);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/charts/query', () => {
    it('returns 200 with the chart result', async () => {
      (services.chartService!.query as any).mockResolvedValue({
        chart: 'pie',
        rows: [{ label: 'Rent', value: 100 }],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/charts/query',
        headers: AUTH,
        payload: { prompt: 'spending by category' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().chart).toBe('pie');
      expect(services.chartService!.query).toHaveBeenCalledWith('user-1', 'spending by category');
    });

    it('returns 400 when the prompt is missing', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/charts/query', headers: AUTH, payload: {} });
      expect(res.statusCode).toBe(400);
    });

    it('returns 422 when the request cannot be mapped', async () => {
      (services.chartService!.query as any).mockRejectedValue(new ChartUnsupportedError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/charts/query',
        headers: AUTH,
        payload: { prompt: 'what is the weather' },
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('CHART_UNSUPPORTED');
    });

    it('returns 503 when generation fails', async () => {
      (services.chartService!.query as any).mockRejectedValue(new ChartGenerationFailedError());

      const res = await app.inject({
        method: 'POST',
        url: '/api/charts/query',
        headers: AUTH,
        payload: { prompt: 'spending by category' },
      });

      expect(res.statusCode).toBe(503);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/charts/query',
        payload: { prompt: 'x' },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
