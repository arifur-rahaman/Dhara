import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '@/server/env';

/**
 * Field encryption (TECH_GUIDE section 7): AES-256-GCM, random 12-byte IV per value,
 * stored as `version:iv:ciphertext:tag` (base64) so keys can rotate.
 */
function keys(): { active: string; map: Record<string, Buffer> } {
  const e = env();
  if (!e.FIELD_ENCRYPTION_KEYS || !e.FIELD_ENCRYPTION_ACTIVE) {
    throw new Error('FIELD_ENCRYPTION_KEYS and FIELD_ENCRYPTION_ACTIVE must be set. See .env.example.');
  }
  const raw = JSON.parse(e.FIELD_ENCRYPTION_KEYS) as Record<string, string>;
  const map: Record<string, Buffer> = {};
  for (const [version, b64] of Object.entries(raw)) {
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) throw new Error(`Field encryption key ${version} must be 32 bytes`);
    map[version] = key;
  }
  if (!map[e.FIELD_ENCRYPTION_ACTIVE]) throw new Error('FIELD_ENCRYPTION_ACTIVE names a missing key');
  return { active: e.FIELD_ENCRYPTION_ACTIVE, map };
}

export function encryptField(plain: string): string {
  const { active, map } = keys();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', map[active], iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [active, iv.toString('base64'), data.toString('base64'), cipher.getAuthTag().toString('base64')].join(':');
}

export function decryptField(stored: string): string {
  const [version, iv, data, tag] = stored.split(':');
  const key = keys().map[version];
  if (!key || !iv || !data || !tag) throw new Error('Unreadable encrypted field');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

/** Hash for high-entropy secrets (session tokens, invite tokens, recovery codes). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

/** Keyed hash for low-entropy values (OTP codes, IP addresses) so a database leak cannot reverse them. */
export function keyedHash(value: string): string {
  const secret = env().SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set. See .env.example.');
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
