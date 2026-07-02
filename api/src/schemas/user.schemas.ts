import { bearerAuth, errorSchema, userSchema } from './common.schemas.js';

export const getMeSchema = {
  tags: ['Users'],
  summary: 'Get the authenticated user profile',
  security: bearerAuth,
  response: {
    200: userSchema,
    401: errorSchema,
    404: errorSchema,
  },
} as const;

export const updateMeSchema = {
  tags: ['Users'],
  summary: 'Update the authenticated user profile',
  security: bearerAuth,
  body: {
    type: 'object',
    properties: {
      username: { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
    },
  },
  response: {
    200: userSchema,
    401: errorSchema,
    404: errorSchema,
    409: errorSchema,
  },
} as const;

export const changePasswordSchema = {
  tags: ['Users'],
  summary: 'Change the authenticated user password',
  security: bearerAuth,
  body: {
    type: 'object',
    properties: {
      currentPassword: { type: 'string', minLength: 1 },
      newPassword: { type: 'string', minLength: 8 },
    },
    required: ['currentPassword', 'newPassword'],
  },
  response: {
    204: { type: 'null' },
    401: errorSchema,
    404: errorSchema,
  },
} as const;

export const deleteMeSchema = {
  tags: ['Users'],
  summary: 'Delete the authenticated user account',
  security: bearerAuth,
  response: {
    204: { type: 'null' },
    401: errorSchema,
    404: errorSchema,
  },
} as const;
