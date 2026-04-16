import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService } from '../services/AuthService.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  registerRoutes(app: FastifyInstance): void {
    app.post('/api/auth/register', (req, reply) => this.register(req, reply));
    app.post('/api/auth/login', (req, reply) => this.login(req, reply));
    app.post('/api/auth/refresh', (req, reply) => this.refresh(req, reply));
  }

  private async register(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { username, email, password } = req.body as {
      username: string;
      email: string;
      password: string;
    };
    const result = await this.authService.register({ username, email, password });
    reply.status(201).send(result);
  }

  private async login(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };
    const result = await this.authService.login({ email, password });
    reply.send(result);
  }

  private async refresh(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { refreshToken } = req.body as { refreshToken: string };
    const result = await this.authService.refresh(refreshToken);
    reply.send(result);
  }
}
