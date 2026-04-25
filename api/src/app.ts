import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebSocket from '@fastify/websocket';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { AuthService } from './services/AuthService.js';
import type { UserService } from './services/UserService.js';
import type { CategoryService } from './services/CategoryService.js';
import type { DocumentService } from './services/DocumentService.js';
import type { ExpenseService } from './services/ExpenseService.js';
import type { ExportService } from './services/ExportService.js';
import type { IJwtService } from './services/JwtService.js';
import type { WebSocketNotifier } from './queue/listeners/WebSocketNotifier.js';
import { AuthController } from './controllers/AuthController.js';
import { UserController } from './controllers/UserController.js';
import { CategoryController } from './controllers/CategoryController.js';
import { DocumentController } from './controllers/DocumentController.js';
import { ExpenseController } from './controllers/ExpenseController.js';
import { ExportController } from './controllers/ExportController.js';
import { registerErrorHandler } from './errors/errorHandler.js';
import { buildAuthMiddleware, buildInternalMiddleware } from './middleware/authMiddleware.js';
import { internalResultSchema } from './schemas/internal.schemas.js';

export interface AppServices {
  authService: AuthService;
  userService: UserService;
  categoryService: CategoryService;
  documentService: DocumentService;
  expenseService: ExpenseService;
  exportService: ExportService;
  jwtService: IJwtService;
  wsNotifier: WebSocketNotifier;
  internalServiceToken: string;
  maxFileSizeBytes: number;
}

export async function buildApp(services: AppServices): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  // Swagger must be registered before routes so it can collect schema info.
  // Controlled via SWAGGER_ENABLED env var — set to 'false' to disable (e.g. in e2e tests).
  if (process.env.SWAGGER_ENABLED !== 'false') {
    await app.register(fastifySwagger, {
      openapi: {
        info: { title: 'Expense Classifier API', version: '1.0.0' },
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
    });
    await app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: false },
    });
  }

  await app.register(fastifyCors, {
    origin: true, // reflect request origin — fine for single-user dev/prod
    credentials: true,
  });

  await app.register(fastifyMultipart, {
    limits: { fileSize: services.maxFileSizeBytes },
  });
  await app.register(fastifyWebSocket);

  registerErrorHandler(app);

  const auth = buildAuthMiddleware(services.jwtService);
  const internalAuth = buildInternalMiddleware(services.internalServiceToken);

  // Public auth routes
  new AuthController(services.authService).registerRoutes(app);

  // Protected user/category/document/expense routes
  new UserController(services.userService).registerRoutes(app, auth);
  new CategoryController(services.categoryService).registerRoutes(app, auth);
  new DocumentController(services.documentService).registerRoutes(app, auth);

  // Export route must be registered before the generic expense routes to take
  // priority over /api/expenses/:id when both match /api/expenses/export.
  new ExportController(services.exportService).registerRoutes(app, auth);
  new ExpenseController(services.expenseService).registerRoutes(app, auth);

  // Internal route (called by the Python worker)
  app.post(
    '/internal/results',
    { preHandler: internalAuth, schema: internalResultSchema },
    async (req, reply) => {
      const body = req.body as {
        documentId: string;
        segmentIndex: number;
        categorySlug: string;
        vendor: string | null;
        amount: number;
        currency: string;
        expenseDate: string;
        confidence: number;
        rawText: string;
      };
      const expense = await services.documentService.recordInternalResult({
        ...body,
        expenseDate: new Date(body.expenseDate),
      });
      reply.status(201).send(expense);
    },
  );

  // WebSocket endpoint for real-time notifications
  app.get('/api/ws', { websocket: true, preHandler: auth }, (socket, req) => {
    services.wsNotifier.register(req.userId, socket);
    socket.on('close', () => {
      services.wsNotifier.unregister(req.userId, socket);
    });
  });

  return app;
}
