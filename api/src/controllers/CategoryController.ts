import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { CategoryService } from '../services/CategoryService.js';

export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  registerRoutes(app: FastifyInstance, auth: preHandlerHookHandler): void {
    app.get('/api/categories', { preHandler: auth }, (req, reply) => this.list(req, reply));
    app.post('/api/categories', { preHandler: auth }, (req, reply) => this.create(req, reply));
    app.delete('/api/categories/:id', { preHandler: auth }, (req, reply) =>
      this.delete(req, reply),
    );
  }

  private async list(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const categories = await this.categoryService.list(req.userId);
    reply.send(categories);
  }

  private async create(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { name, slug } = req.body as { name: string; slug: string };
    const category = await this.categoryService.create(req.userId, { name, slug });
    reply.status(201).send(category);
  }

  private async delete(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    await this.categoryService.delete(req.userId, id);
    reply.status(204).send();
  }
}
