import { bearerAuth, errorSchema } from './common.schemas.js';

export const chartQuerySchema = {
  tags: ['Charts'],
  summary: 'Turn a natural-language question into a chart of your own expenses',
  description:
    'The LLM only produces a whitelisted query spec; the API compiles it to ' +
    'parameterised SQL scoped to your user and returns the aggregated rows.',
  security: bearerAuth,
  body: {
    type: 'object',
    properties: {
      prompt: { type: 'string', minLength: 1, maxLength: 500 },
    },
    required: ['prompt'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        chart: { type: 'string', enum: ['bar', 'pie', 'line', 'table'] },
        rows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'number' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['chart', 'rows'],
    },
    400: errorSchema,
    401: errorSchema,
    422: errorSchema,
    503: errorSchema,
  },
} as const;
