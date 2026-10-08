import { resolve } from 'node:path';

/**
 * Production-build journeys (next build + next start). Used for what `next dev` cannot show faithfully,
 * such as the service worker serving the saved offline page. People are seeded directly in the database,
 * because production refuses the test SMS provider.
 */
export const prodEnv = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://dhara_app:dhara_app@localhost:5432/dhara_e2e',
  DATABASE_ADMIN_URL:
    process.env.TEST_DATABASE_ADMIN_URL ?? 'postgresql://dhara_admin:dhara_admin@localhost:5432/dhara_e2e',
  DATABASE_JOBS_URL:
    process.env.TEST_DATABASE_JOBS_URL ?? 'postgresql://dhara_jobs:dhara_jobs@localhost:5432/dhara_e2e',
  DATABASE_MIGRATE_URL: process.env.TEST_DATABASE_MIGRATE_URL ?? 'postgresql://dhara:dhara@localhost:5432/dhara_e2e',
  SESSION_SECRET: 'prod-e2e-session-secret-prod-e2e-session-secret',
  FIELD_ENCRYPTION_KEYS: JSON.stringify({ v1: Buffer.alloc(32, 9).toString('base64') }),
  FIELD_ENCRYPTION_ACTIVE: 'v1',
  STORAGE_PROVIDER: 's3',
  S3_ENDPOINT: 'http://127.0.0.1:1',
  S3_BUCKET: 'unused',
  S3_ACCESS_KEY: 'unused',
  S3_SECRET_KEY: 'unused',
  STORAGE_DIR: resolve('test-results/storage-prod'),
};
