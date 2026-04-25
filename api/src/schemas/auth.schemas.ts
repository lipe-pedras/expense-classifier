import { errorSchema, userSchema } from './common.schemas.js';

const authResponseSchema = {
  type: 'object',
  properties: {
    user: userSchema,
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
  },
  required: ['user', 'accessToken', 'refreshToken'],
} as const;

export const registerSchema = {
  tags: ['Auth'],
  summary: 'Register a new user',
  body: {
    type: 'object',
    properties: {
      username: { type: 'string', minLength: 1 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
    },
    required: ['username', 'email', 'password'],
  },
  response: {
    201: authResponseSchema,
    409: errorSchema,
  },
} as const;

export const loginSchema = {
  tags: ['Auth'],
  summary: 'Log in with email and password',
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
    required: ['email', 'password'],
  },
  response: {
    200: authResponseSchema,
    401: errorSchema,
  },
} as const;

export const refreshSchema = {
  tags: ['Auth'],
  summary: 'Refresh access token using refresh token',
  body: {
    type: 'object',
    properties: {
      refreshToken: { type: 'string' },
    },
    required: ['refreshToken'],
  },
  response: {
    200: authResponseSchema,
    401: errorSchema,
  },
} as const;
