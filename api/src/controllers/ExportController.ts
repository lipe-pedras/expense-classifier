import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { ExportService } from '../services/ExportService.js';
import type { ExpenseFilters } from '../types/index.js';

const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  registerRoutes(app: FastifyInstance, auth: preHandlerHookHandler): void {
    app.get('/api/expenses/export', { preHandler: auth }, (req, reply) =>
      this.export(req, reply),
    );
  }

  private async export(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const q = req.query as Record<string, string>;
    const filters: ExpenseFilters = {};
    if (q.categorySlug) filters.categorySlug = q.categorySlug;
    if (q.vendor) filters.vendor = q.vendor;
    if (q.dateFrom) filters.dateFrom = new Date(q.dateFrom);
    if (q.dateTo) filters.dateTo = new Date(q.dateTo);
    if (q.minAmount) filters.minAmount = Number(q.minAmount);
    if (q.maxAmount) filters.maxAmount = Number(q.maxAmount);

    const buffer = await this.exportService.exportExpenses(req.userId, filters);
    reply
      .header('Content-Type', XLSX_CONTENT_TYPE)
      .header('Content-Disposition', 'attachment; filename="expenses.xlsx"')
      .send(buffer);
  }
}
