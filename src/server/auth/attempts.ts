import 'server-only';
import { keyedHash } from '@/server/crypto';
import { prisma } from '@/server/db/client';

/** The admin portal passes its own client; both roles may use auth_attempts. */
type Db = Pick<typeof prisma, 'authAttempt'>;

const WINDOW_MS = 15 * 60 * 1000;

/** True when the key has had `max` failures in the last 15 minutes. */
export async function tooManyFailures(key: string, max = 5, db: Db = prisma) {
  const since = new Date(Date.now() - WINDOW_MS);
  return (await db.authAttempt.count({ where: { keyHash: keyedHash(key), createdAt: { gte: since } } })) >= max;
}

export async function recordFailure(key: string, db: Db = prisma) {
  await db.authAttempt.create({ data: { keyHash: keyedHash(key) } });
}

export async function clearFailures(key: string, db: Db = prisma) {
  await db.authAttempt.deleteMany({ where: { keyHash: keyedHash(key) } });
}
