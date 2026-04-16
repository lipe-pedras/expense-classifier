import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IJwtService } from '../services/JwtService.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export function buildAuthMiddleware(jwt: IJwtService) {
  return async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = req.headers.authorization;
    let token: string | undefined;

    if (header?.startsWith('Bearer ')) {
      token = header.slice(7);
    } else {
      // Fallback: allow token via query param for WebSocket upgrade requests
      const q = req.query as Record<string, string>;
      token = q.token;
    }

    if (!token) {
      return reply.status(401).send({ error: { code: 'AUTH_TOKEN_INVALID', message: 'Missing or invalid Authorization header' } });
    }
    // verifyAccessToken throws AppError on failure — caught by global error handler
    const { userId } = jwt.verifyAccessToken(token);
    req.userId = userId;
  };
}

export function buildInternalMiddleware(expectedToken: string) {
  return async function authenticateInternal(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = req.headers.authorization;
    if (header !== `Bearer ${expectedToken}`) {
      return reply.status(401).send({ error: { code: 'AUTH_TOKEN_INVALID', message: 'Invalid internal service token' } });
    }
  };
}
