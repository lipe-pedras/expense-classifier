import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { ChartService } from '../services/ChartService.js';
import { chartQuerySchema } from '../schemas/chart.schemas.js';

export class ChartController {
  constructor(private readonly chartService: ChartService) {}

  registerRoutes(app: FastifyInstance, auth: preHandlerHookHandler): void {
    app.post('/api/charts/query', { preHandler: auth, schema: chartQuerySchema }, (req, reply) =>
      this.query(req, reply),
    );
  }

  private async query(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { prompt } = req.body as { prompt: string };
    const result = await this.chartService.query(req.userId, prompt);
    reply.send(result);
  }
}
