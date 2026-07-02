import { bearerAuth, errorSchema, expenseFiltersQuerySchema, expenseSchema, idParamSchema } from './common.schemas.js';

export const listExpensesSchema = {
  tags: ['Expenses'],
  summary: 'List expenses with optional filters',
  security: bearerAuth,
  querystring: expenseFiltersQuerySchema,
  response: {
    200: { type: 'array', items: expenseSchema },
    401: errorSchema,
  },
} as const;

export const getDashboardSchema = {
  tags: ['Expenses'],
  summary: 'Get dashboard summary (current month by category + monthly history)',
  security: bearerAuth,
  querystring: {
    type: 'object',
    properties: {
      months: { type: 'string', description: 'Number of months of history to include (default: 6)' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        currentMonth: {
          type: 'object',
          properties: {
            byCategory: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  categorySlug: { type: 'string' },
                  categoryName: { type: 'string' },
                  total: { type: 'number' },
                },
                required: ['categorySlug', 'categoryName', 'total'],
              },
            },
          },
          required: ['byCategory'],
        },
        history: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              month: { type: 'string' },
              total: { type: 'number' },
            },
            required: ['month', 'total'],
          },
        },
      },
      required: ['currentMonth', 'history'],
    },
    401: errorSchema,
  },
} as const;

export const createExpenseSchema = {
  tags: ['Expenses'],
  summary: 'Manually create an expense',
  security: bearerAuth,
  body: {
    type: 'object',
    properties: {
      amount: { type: 'number' },
      currency: { type: 'string' },
      expenseDate: { type: 'string', format: 'date-time' },
      vendor: { type: ['string', 'null'] },
      categoryId: { type: 'string' },
    },
    required: ['amount', 'expenseDate', 'categoryId'],
  },
  response: {
    201: expenseSchema,
    401: errorSchema,
    404: errorSchema,
  },
} as const;

export const getExpenseSchema = {
  tags: ['Expenses'],
  summary: 'Get an expense by ID',
  security: bearerAuth,
  params: idParamSchema,
  response: {
    200: expenseSchema,
    401: errorSchema,
    404: errorSchema,
  },
} as const;

export const updateExpenseSchema = {
  tags: ['Expenses'],
  summary: 'Update an expense',
  security: bearerAuth,
  params: idParamSchema,
  body: {
    type: 'object',
    properties: {
      amount: { type: 'number' },
      currency: { type: 'string' },
      expenseDate: { type: 'string', format: 'date-time' },
      vendor: { type: ['string', 'null'] },
      categoryId: { type: 'string' },
    },
  },
  response: {
    200: expenseSchema,
    401: errorSchema,
    404: errorSchema,
  },
} as const;

export const deleteExpenseSchema = {
  tags: ['Expenses'],
  summary: 'Delete an expense by ID',
  security: bearerAuth,
  params: idParamSchema,
  response: {
    204: { type: 'null' },
    401: errorSchema,
    404: errorSchema,
  },
} as const;
