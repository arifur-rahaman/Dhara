import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { randomToken, sha256 } from '@/server/crypto';
import { prisma } from '@/server/db/client';

/** Database sessions (TECH_GUIDE section 5). The cookie holds a random token; the database holds its hash. */
export const SESSION_COOKIE = 'dhara_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string, opts: { mfaVerified: boolean; userAgent?: string | null }) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      mfaVerifiedAt: opts.mfaVerified ? new Date() : null,
      userAgent: opts.userAgent?.slice(0, 200) ?? null,
      expiresAt,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** The current session and its user, once per request. */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  // "Last active" for the device list in Settings; written at most once an hour per session.
  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_EVERY_MS) {
    await prisma.session.updateMany({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return session;
});

const LAST_SEEN_EVERY_MS = 60 * 60 * 1000;

/** This person's signed-in devices: sessions that are neither ended nor expired, newest activity first. */
export async function activeSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true },
    orderBy: { lastSeenAt: 'desc' },
  });
}

/**
 * Ends some of this person's sessions (remote log out). Only their own sessions can match.
 * Returns the ids that were ended, so the caller can forget those devices' push subscriptions.
 */
export async function revokeSessions(userId: string, where: { id: string } | { notId: string }) {
  const filter = 'id' in where ? { id: where.id } : { id: { not: where.notId } };
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, ...filter },
    select: { id: true },
  });
  const ids = sessions.map((s) => s.id);
  if (ids.length) {
    await prisma.session.updateMany({ where: { id: { in: ids }, userId }, data: { revokedAt: new Date() } });
  }
  return ids;
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(SESSION_COOKIE);
}

export async function markMfaVerified(sessionId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { mfaVerifiedAt: new Date() } });
}

export async function setActiveChamber(sessionId: string, chamberId: string) {
  await prisma.session.update({ where: { id: sessionId }, data: { activeChamberId: chamberId } });
}
