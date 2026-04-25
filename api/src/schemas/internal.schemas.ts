import { errorSchema, expenseSchema } from './common.schemas.js';

export const internalResultSchema = {
  tags: ['Internal'],
  summary: 'Record an expense extracted by the AI worker (internal use only)',
  body: {
    type: 'object',
    properties: {
      documentId: { type: 'string' },
      segmentIndex: { type: 'number' },
      categorySlug: { type: 'string' },
      vendor: { type: ['string', 'null'] },
      amount: { type: 'number' },
      currency: { type: 'string' },
      expenseDate: { type: 'string' },
      confidence: { type: 'number' },
      rawText: { type: 'string' },
    },
    required: ['documentId', 'segmentIndex', 'categorySlug', 'amount', 'currency', 'expenseDate', 'confidence', 'rawText'],
  },
  response: {
    201: expenseSchema,
    401: errorSchema,
    404: errorSchema,
  },
} as const;
