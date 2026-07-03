import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { CategoryService } from '../services/CategoryService.js';
import {
  createCategorySchema,
  deleteCategorySchema,
  listCategoriesSchema,
  updateCategorySchema,
} from '../schemas/category.schemas.js';

export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  registerRoutes(app: FastifyInstance, auth: preHandlerHookHandler): void {
    app.get('/api/categories', { preHandler: auth, schema: listCategoriesSchema }, (req, reply) => this.list(req, reply));
    app.post('/api/categories', { preHandler: auth, schema: createCategorySchema }, (req, reply) => this.create(req, reply));
    app.put('/api/categories/:id', { preHandler: auth, schema: updateCategorySchema }, (req, reply) =>
      this.update(req, reply),
    );
    app.delete('/api/categories/:id', { preHandler: auth, schema: deleteCategorySchema }, (req, reply) =>
      this.delete(req, reply),
    );
  }

  private async list(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const categories = await this.categoryService.list(req.userId);
    reply.send(categories);
  }

  private async create(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { name } = req.body as { name: string };
    const category = await this.categoryService.create(req.userId, { name });
    reply.status(201).send(category);
  }

  private async update(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    const { name } = req.body as { name: string };
    const category = await this.categoryService.update(req.userId, id, { name });
    reply.send(category);
  }

  private async delete(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    await this.categoryService.delete(req.userId, id);
    reply.status(204).send();
  }
}
