import { bearerAuth, errorSchema, expenseFiltersQuerySchema } from './common.schemas.js';

export const exportExpensesSchema = {
  tags: ['Export'],
  summary: 'Export expenses as an Excel (.xlsx) file',
  description: 'Returns a binary XLSX file with filtered expenses. Supports the same filters as the expense list endpoint.',
  security: bearerAuth,
  querystring: expenseFiltersQuerySchema,
  produces: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  response: {
    200: {
      type: 'string',
      format: 'binary',
      description: 'XLSX file attachment',
    },
    401: errorSchema,
  },
} as const;
