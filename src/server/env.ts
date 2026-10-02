import 'server-only';
import { z } from 'zod';

const optional = z.string().optional();

/**
 * Every server environment variable. Values that later milestones need are
 * optional until that milestone makes them required. Keep .env.example in
 * sync (a unit test checks it).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  APP_URL: z.url().default('http://localhost:3000'),
  ADMIN_URL: optional,
  SESSION_SECRET: optional,

  DATABASE_URL: optional,
  DATABASE_ADMIN_URL: optional,
  DATABASE_MIGRATE_URL: optional,

  FIELD_ENCRYPTION_KEYS: optional,
  FIELD_ENCRYPTION_ACTIVE: optional,

  SMS_PROVIDER: z.enum(['console', 'file']).default('console'),
  SMS_API_KEY: optional,
  SMS_SENDER_ID: optional,
  SMS_OUTBOX_FILE: optional,

  WHATSAPP_PHONE_NUMBER_ID: optional,
  WHATSAPP_ACCESS_TOKEN: optional,
  WHATSAPP_WEBHOOK_SECRET: optional,

  PAYMENT_PROVIDER: optional,
  PAYMENT_API_KEY: optional,
  PAYMENT_WEBHOOK_SECRET: optional,

  S3_ENDPOINT: optional,
  S3_REGION: optional,
  S3_BUCKET: optional,
  S3_ACCESS_KEY: optional,
  S3_SECRET_KEY: optional,

  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional,

  ANTHROPIC_API_KEY: optional,
  AI_MODEL_DRAFT: optional,
  AI_MODEL_EXTRACT: optional,

  ADMIN_IP_ALLOWLIST: optional,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Parsed environment. Throws a readable error naming the bad variables (never their values). */
export function env(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment variables: ${names}. See .env.example.`);
  }
  cached = result.data;
  return cached;
}
