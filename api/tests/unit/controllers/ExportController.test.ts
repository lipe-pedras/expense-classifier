import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import * as XLSX from 'xlsx';
import { buildTestApp, makeMockServices, type AppServices } from '../../helpers/testApp.js';

const AUTH = { authorization: 'Bearer valid-token' };
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function makeXlsxBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Date: '2026-01-01', Amount: 100 }]), 'Expenses');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('ExportController', () => {
  let services: AppServices;
  let app: FastifyInstance;

  beforeEach(async () => {
    services = makeMockServices();
    app = await buildTestApp(services);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/expenses/export', () => {
    it('should return 200 with xlsx content type', async () => {
      (services.exportService.exportExpenses as any).mockResolvedValue(makeXlsxBuffer());

      const res = await app.inject({
        method: 'GET',
        url: '/api/expenses/export',
        headers: AUTH,
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain(XLSX_MIME);
      expect(res.headers['content-disposition']).toContain('expenses.xlsx');
    });

    it('should forward filter query params to the service', async () => {
      (services.exportService.exportExpenses as any).mockResolvedValue(makeXlsxBuffer());

      await app.inject({
        method: 'GET',
        url: '/api/expenses/export?categorySlug=rent&vendor=Acme',
        headers: AUTH,
      });

      expect(services.exportService.exportExpenses).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ categorySlug: 'rent', vendor: 'Acme' }),
      );
    });

    it('should return 401 without a token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/expenses/export' });
      expect(res.statusCode).toBe(401);
    });
  });
});
