import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { UserService } from '../services/UserService.js';
import { deleteMeSchema, getMeSchema, updateMeSchema } from '../schemas/user.schemas.js';

export class UserController {
  constructor(private readonly userService: UserService) {}

  registerRoutes(app: FastifyInstance, auth: preHandlerHookHandler): void {
    app.get('/api/users/me', { preHandler: auth, schema: getMeSchema }, (req, reply) => this.getMe(req, reply));
    app.put('/api/users/me', { preHandler: auth, schema: updateMeSchema }, (req, reply) => this.updateMe(req, reply));
    app.delete('/api/users/me', { preHandler: auth, schema: deleteMeSchema }, (req, reply) => this.deleteMe(req, reply));
  }

  private async getMe(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = await this.userService.getById(req.userId);
    reply.send(user);
  }

  private async updateMe(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const input = req.body as { username?: string; email?: string };
    const user = await this.userService.update(req.userId, input);
    reply.send(user);
  }

  private async deleteMe(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    await this.userService.delete(req.userId);
    reply.status(204).send();
  }
}
