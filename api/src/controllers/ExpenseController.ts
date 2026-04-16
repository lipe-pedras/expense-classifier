import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { ExpenseService } from '../services/ExpenseService.js';
import type { ExpenseFilters } from '../types/index.js';

export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  registerRoutes(app: FastifyInstance, auth: preHandlerHookHandler): void {
    // Static routes must be registered before parametric ones
    app.get('/api/expenses/dashboard', { preHandler: auth }, (req, reply) =>
      this.getDashboard(req, reply),
    );
    app.get('/api/expenses', { preHandler: auth }, (req, reply) => this.list(req, reply));
    app.get('/api/expenses/:id', { preHandler: auth }, (req, reply) => this.getById(req, reply));
    app.put('/api/expenses/:id', { preHandler: auth }, (req, reply) => this.update(req, reply));
    app.delete('/api/expenses/:id', { preHandler: auth }, (req, reply) =>
      this.delete(req, reply),
    );
  }

  private async list(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const q = req.query as Record<string, string>;
    const filters: ExpenseFilters = {};
    if (q.categorySlug) filters.categorySlug = q.categorySlug;
    if (q.vendor) filters.vendor = q.vendor;
    if (q.dateFrom) filters.dateFrom = new Date(q.dateFrom);
    if (q.dateTo) filters.dateTo = new Date(q.dateTo);
    if (q.minAmount) filters.minAmount = Number(q.minAmount);
    if (q.maxAmount) filters.maxAmount = Number(q.maxAmount);

    const expenses = await this.expenseService.list(req.userId, filters);
    reply.send(expenses);
  }

  private async getDashboard(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const q = req.query as Record<string, string>;
    const months = q.months ? Number(q.months) : 6;
    const data = await this.expenseService.getDashboard(req.userId, months);
    reply.send(data);
  }

  private async getById(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    const expense = await this.expenseService.getById(req.userId, id);
    reply.send(expense);
  }

  private async update(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    const body = req.body as {
      amount?: number;
      currency?: string;
      expenseDate?: string;
      vendor?: string | null;
      categoryId?: string;
    };
    const input = {
      ...body,
      expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined,
    };
    const expense = await this.expenseService.update(req.userId, id, input);
    reply.send(expense);
  }

  private async delete(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    await this.expenseService.delete(req.userId, id);
    reply.status(204).send();
  }
}
