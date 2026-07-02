export const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['code', 'message'],
    },
  },
  required: ['error'],
} as const;

export const idParamSchema = {
  type: 'object',
  properties: { id: { type: 'string' } },
  required: ['id'],
} as const;

export const bearerAuth = [{ bearerAuth: [] }] as const;

export const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    email: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'username', 'email', 'createdAt'],
} as const;

export const categorySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    isSystem: { type: 'boolean' },
  },
  required: ['id', 'userId', 'name', 'slug', 'isSystem'],
} as const;

export const documentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    originalName: { type: 'string' },
    filePath: { type: 'string' },
    fileType: { type: 'string', enum: ['PDF', 'IMAGE'] },
    status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'DONE', 'FAILED'] },
    expenseCount: { type: 'number' },
    uploadedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'userId', 'originalName', 'filePath', 'fileType', 'status', 'expenseCount', 'uploadedAt'],
} as const;

export const expenseSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    documentId: { type: ['string', 'null'] },
    userId: { type: 'string' },
    categoryId: { type: 'string' },
    segmentIndex: { type: 'number' },
    amount: { type: 'number' },
    currency: { type: 'string' },
    expenseDate: { type: 'string', format: 'date-time' },
    vendor: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    rawText: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'userId', 'categoryId', 'segmentIndex', 'amount', 'currency', 'expenseDate', 'confidence', 'rawText', 'createdAt'],
} as const;

export const expenseFiltersQuerySchema = {
  type: 'object',
  properties: {
    categorySlug: { type: 'string' },
    vendor: { type: 'string' },
    dateFrom: { type: 'string', format: 'date-time' },
    dateTo: { type: 'string', format: 'date-time' },
    minAmount: { type: 'string' },
    maxAmount: { type: 'string' },
  },
} as const;
