import { bearerAuth, categorySchema, errorSchema, idParamSchema } from './common.schemas.js';

export const listCategoriesSchema = {
  tags: ['Categories'],
  summary: 'List all categories for the authenticated user',
  security: bearerAuth,
  response: {
    200: { type: 'array', items: categorySchema },
    401: errorSchema,
  },
} as const;

export const createCategorySchema = {
  tags: ['Categories'],
  summary: 'Create a new category',
  description: 'The slug is derived automatically from the name.',
  security: bearerAuth,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
    },
    required: ['name'],
  },
  response: {
    201: categorySchema,
    400: errorSchema,
    401: errorSchema,
    409: errorSchema,
  },
} as const;

export const updateCategorySchema = {
  tags: ['Categories'],
  summary: 'Rename a category by ID',
  description: 'System categories cannot be renamed. The slug is re-derived from the name.',
  security: bearerAuth,
  params: idParamSchema,
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
    },
    required: ['name'],
  },
  response: {
    200: categorySchema,
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    404: errorSchema,
    409: errorSchema,
  },
} as const;

export const deleteCategorySchema = {
  tags: ['Categories'],
  summary: 'Delete a category by ID',
  security: bearerAuth,
  params: idParamSchema,
  response: {
    204: { type: 'null' },
    401: errorSchema,
    403: errorSchema,
    404: errorSchema,
  },
} as const;
