import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { randomToken, sha256 } from '@/server/crypto';
import { adminDb } from '@/server/db/admin-client';
import { requestIpHash } from '@/server/request';

/**
 * Admin portal sessions (TECH_GUIDE section 5): their own cookie, scoped to /admin, short-lived,
 * and created only after phone, password and a TOTP code all check out.
 */
export const ADMIN_COOKIE = 'dhara_admin';
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;

export async function createAdminSession(adminId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_MS);
  await adminDb.adminSession.create({
    data: { tokenHash: sha256(token), adminId, ipHash: await requestIpHash(), expiresAt },
  });
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    expires: expiresAt,
  });
}

export const getAdmin = cache(async () => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = await adminDb.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { admin: { select: { id: true, name: true, role: true, disabledAt: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date() || session.admin.disabledAt) return null;
  return { sessionId: session.id, id: session.admin.id, name: session.admin.name, role: session.admin.role };
});

export type AdminCtx = NonNullable<Awaited<ReturnType<typeof getAdmin>>>;

export async function requireAdmin(): Promise<AdminCtx> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}

export async function endAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) {
    await adminDb.adminSession.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete({ name: ADMIN_COOKIE, path: '/admin' });
}
