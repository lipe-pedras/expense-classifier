import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { DocumentService } from '../services/DocumentService.js';
import {
  deleteDocumentSchema,
  getDocumentSchema,
  listDocumentsSchema,
  uploadDocumentSchema,
} from '../schemas/document.schemas.js';

export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  registerRoutes(app: FastifyInstance, auth: preHandlerHookHandler): void {
    app.post('/api/documents', { preHandler: auth, schema: uploadDocumentSchema }, (req, reply) => this.upload(req, reply));
    app.get('/api/documents', { preHandler: auth, schema: listDocumentsSchema }, (req, reply) => this.list(req, reply));
    app.get('/api/documents/:id', { preHandler: auth, schema: getDocumentSchema }, (req, reply) => this.getById(req, reply));
    app.delete('/api/documents/:id', { preHandler: auth, schema: deleteDocumentSchema }, (req, reply) =>
      this.delete(req, reply),
    );
  }

  private async upload(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    let data;
    try {
      data = await req.file();
    } catch {
      return reply
        .status(400)
        .send({ error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' } });
    }
    if (!data) {
      return reply
        .status(400)
        .send({ error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' } });
    }

    const buffer = await data.toBuffer();
    const document = await this.documentService.upload(req.userId, {
      buffer,
      originalName: data.filename,
      mimeType: data.mimetype,
    });
    reply.status(201).send(document);
  }

  private async list(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const documents = await this.documentService.list(req.userId);
    reply.send(documents);
  }

  private async getById(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    const document = await this.documentService.getById(req.userId, id);
    reply.send(document);
  }

  private async delete(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { id } = req.params as { id: string };
    await this.documentService.delete(req.userId, id);
    reply.status(204).send();
  }
}
