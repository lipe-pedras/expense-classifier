import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

export type AuthPreHandler = preHandlerHookHandler;

/**
 * Base class that provides a typed hook for registering routes under an
 * authenticated scope. Subclasses call `this.register(app, auth)`.
 */
export abstract class BaseController {
  abstract registerRoutes(app: FastifyInstance, auth: AuthPreHandler): void;

  protected sendCreated(reply: FastifyReply, data: unknown): FastifyReply {
    return reply.status(201).send(data);
  }

  protected sendNoContent(reply: FastifyReply): FastifyReply {
    return reply.status(204).send();
  }

  protected getUserId(req: FastifyRequest): string {
    return req.userId;
  }
}
