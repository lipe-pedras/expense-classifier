import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { E2E_INTERNAL_TOKEN } from './buildE2eApp.js';

export interface AuthResult {
  user: { id: string; username: string; email: string; createdAt: string };
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  username?: string;
  email?: string;
  password?: string;
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function internalAuthHeader(): Record<string, string> {
  return { Authorization: `Bearer ${E2E_INTERNAL_TOKEN}` };
}

export async function registerAndLogin(app: FastifyInstance, overrides: RegisterInput = {}): Promise<AuthResult> {
  const tag = randomUUID().slice(0, 8);
  const payload = {
    username: overrides.username ?? `e2euser_${tag}`,
    email: overrides.email ?? `e2e_${tag}@test.example`,
    password: overrides.password ?? 'password123',
  };

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload,
  });

  if (res.statusCode !== 201) {
    throw new Error(`registerAndLogin failed: ${res.statusCode} ${res.body}`);
  }

  return res.json() as AuthResult;
}

/**
 * Builds a raw multipart/form-data body for a single-file upload.
 * Returns { body, contentType } ready for use with app.inject().
 */
export function buildMultipartBody(
  fieldName: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
): { body: Buffer; contentType: string } {
  const boundary = `----e2eboundary${randomUUID().replace(/-/g, '')}`;
  const CRLF = '\r\n';

  const header =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"${CRLF}` +
    `Content-Type: ${mimeType}${CRLF}` +
    CRLF;

  const footer = `${CRLF}--${boundary}--${CRLF}`;

  const body = Buffer.concat([
    Buffer.from(header, 'utf8'),
    fileBuffer,
    Buffer.from(footer, 'utf8'),
  ]);

  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

// Minimal valid 1x1 white PNG (67 bytes)
export const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001' +
  '0806000000001f15c4890000000a4944415478016360f8cf' +
  'c00000000200019e221bc60000000049454e44ae426082',
  'hex',
);

// Minimal PDF (enough bytes to pass MIME type check — mimetype comes from the header, not file magic)
export const TINY_PDF = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8');

/**
 * Uploads a test file and returns the created Document.
 */
export async function uploadTestFile(
  app: FastifyInstance,
  token: string,
  opts: { fileName?: string; buffer?: Buffer; mimeType?: string } = {},
) {
  const fileName = opts.fileName ?? 'test.png';
  const buffer = opts.buffer ?? TINY_PNG;
  const mimeType = opts.mimeType ?? 'image/png';

  const { body, contentType } = buildMultipartBody('file', fileName, buffer, mimeType);

  const res = await app.inject({
    method: 'POST',
    url: '/api/documents',
    headers: { ...authHeader(token), 'content-type': contentType },
    payload: body,
  });

  if (res.statusCode !== 201) {
    throw new Error(`uploadTestFile failed: ${res.statusCode} ${res.body}`);
  }

  return res.json() as {
    id: string;
    userId: string;
    originalName: string;
    filePath: string;
    fileType: string;
    status: string;
    expenseCount: number;
    uploadedAt: string;
  };
}

/**
 * Polls GET /api/documents/:id until status is DONE or the timeout expires.
 */
export async function waitForDocumentDone(
  app: FastifyInstance,
  token: string,
  documentId: string,
  maxMs = 8000,
): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const res = await app.inject({
      method: 'GET',
      url: `/api/documents/${documentId}`,
      headers: authHeader(token),
    });
    const doc = res.json() as { status: string };
    if (doc.status === 'DONE') return;
    if (doc.status === 'FAILED') throw new Error(`Document ${documentId} processing FAILED`);
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Document ${documentId} did not reach DONE within ${maxMs}ms`);
}
