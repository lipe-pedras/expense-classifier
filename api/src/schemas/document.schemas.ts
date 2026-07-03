import { bearerAuth, documentSchema, errorSchema, idParamSchema } from './common.schemas.js';

// Multipart upload — no body schema (multipart bypasses Fastify body parsing)
export const uploadDocumentSchema = {
  tags: ['Documents'],
  summary: 'Upload a document (PDF or image) for expense extraction',
  security: bearerAuth,
  consumes: ['multipart/form-data'],
  response: {
    201: documentSchema,
    400: errorSchema,
    401: errorSchema,
    413: errorSchema,
    415: errorSchema,
  },
} as const;

export const listDocumentsSchema = {
  tags: ['Documents'],
  summary: 'List all documents uploaded by the authenticated user',
  security: bearerAuth,
  response: {
    200: { type: 'array', items: documentSchema },
    401: errorSchema,
  },
} as const;

export const getDocumentSchema = {
  tags: ['Documents'],
  summary: 'Get a document by ID',
  security: bearerAuth,
  params: idParamSchema,
  response: {
    200: documentSchema,
    401: errorSchema,
    404: errorSchema,
  },
} as const;

export const renameDocumentSchema = {
  tags: ['Documents'],
  summary: 'Rename a document (name is made unique per user)',
  security: bearerAuth,
  params: idParamSchema,
  body: {
    type: 'object',
    properties: {
      originalName: { type: 'string', minLength: 1 },
    },
    required: ['originalName'],
  },
  response: {
    200: documentSchema,
    400: errorSchema,
    401: errorSchema,
    404: errorSchema,
  },
} as const;

export const reprocessDocumentSchema = {
  tags: ['Documents'],
  summary: 'Re-run extraction and classification on a document',
  security: bearerAuth,
  params: idParamSchema,
  response: {
    200: documentSchema,
    401: errorSchema,
    404: errorSchema,
  },
} as const;

export const deleteDocumentSchema = {
  tags: ['Documents'],
  summary: 'Delete a document by ID',
  security: bearerAuth,
  params: idParamSchema,
  response: {
    204: { type: 'null' },
    401: errorSchema,
    404: errorSchema,
  },
} as const;
