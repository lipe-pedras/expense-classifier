export const SYSTEM_CATEGORIES: ReadonlyArray<{ slug: string; name: string }> = [
  { slug: 'rent', name: 'Rent' },
  { slug: 'water', name: 'Water' },
  { slug: 'electricity', name: 'Electricity' },
  { slug: 'internet', name: 'Internet' },
  { slug: 'insurance', name: 'Insurance' },
  { slug: 'other', name: 'Other' },
];

export const ACCEPTED_MIME_TYPES: ReadonlyArray<string> = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  internalServiceToken: string;
  fileUploadPath: string;
  maxFileSizeBytes: number;
  redisUrl: string;
  /**
   * Connection string for the least-privilege, read-only `chart_reader` role
   * used to execute LLM-authored chart SQL under Row-Level Security. Falls back
   * to the dev role baked into the RLS migration.
   */
  chartDatabaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const maxMb = Number(env.MAX_FILE_SIZE_MB ?? 20);
  return {
    port: Number(env.PORT ?? 3000),
    jwtSecret: env.JWT_SECRET ?? 'dev_jwt_secret',
    jwtRefreshSecret: env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
    accessTokenTtlSeconds: 15 * 60,
    refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
    internalServiceToken: env.INTERNAL_SERVICE_TOKEN ?? 'dev_internal_token',
    fileUploadPath: env.FILE_UPLOAD_PATH ?? '/app/uploads',
    maxFileSizeBytes: maxMb * 1024 * 1024,
    redisUrl: env.REDIS_URL ?? 'redis://redis:6379',
    chartDatabaseUrl:
      env.CHART_DATABASE_URL ??
      'postgresql://chart_reader:chart_reader_pw@postgres:5432/expense_classifier',
  };
}

export const config = loadConfig();
