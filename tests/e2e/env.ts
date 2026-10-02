import { resolve } from 'node:path';

/** Environment for the app under end-to-end test: its own database and a file instead of real SMS. */
export const e2eEnv = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgresql://dhara_app:dhara_app@localhost:5432/dhara_e2e',
  DATABASE_ADMIN_URL:
    process.env.E2E_DATABASE_ADMIN_URL ?? 'postgresql://dhara_admin:dhara_admin@localhost:5432/dhara_e2e',
  DATABASE_MIGRATE_URL: process.env.E2E_DATABASE_MIGRATE_URL ?? 'postgresql://dhara:dhara@localhost:5432/dhara_e2e',
  SESSION_SECRET: 'e2e-session-secret-e2e-session-secret-0000',
  FIELD_ENCRYPTION_KEYS: JSON.stringify({ v1: Buffer.alloc(32, 5).toString('base64') }),
  FIELD_ENCRYPTION_ACTIVE: 'v1',
  SMS_PROVIDER: 'file',
  // Every test signs in from the same address; the per-phone limit (3 per 15 minutes) still applies.
  OTP_LIMIT_PER_IP: '100000',
  SMS_OUTBOX_FILE: resolve('test-results/sms-outbox.jsonl'),
};
