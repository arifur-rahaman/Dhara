import 'server-only';
import { keyedHash } from '@/server/crypto';
import { prisma } from '@/server/db/client';

const WINDOW_MS = 15 * 60 * 1000;

/** True when the key has had `max` failures in the last 15 minutes. */
export async function tooManyFailures(key: string, max = 5) {
  const since = new Date(Date.now() - WINDOW_MS);
  return (await prisma.authAttempt.count({ where: { keyHash: keyedHash(key), createdAt: { gte: since } } })) >= max;
}

export async function recordFailure(key: string) {
  await prisma.authAttempt.create({ data: { keyHash: keyedHash(key) } });
}

export async function clearFailures(key: string) {
  await prisma.authAttempt.deleteMany({ where: { keyHash: keyedHash(key) } });
}
