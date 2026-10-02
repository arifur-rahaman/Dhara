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
  return session;
});

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
