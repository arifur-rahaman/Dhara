import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Ctx } from '@/server/authz';
import { getSession, setActiveChamber } from '@/server/auth/session';
import { withTenant } from '@/server/db/tenant';

/**
 * Who is asking, in which chamber, with which role. Loaded once per request from the session
 * and the active membership. The role always comes from the database, never from the client.
 */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const session = await getSession();
  if (!session || !session.mfaVerifiedAt) return null;
  const userId = session.userId;

  const memberships = await withTenant({ userId }, (tx) =>
    tx.membership.findMany({ where: { userId, status: 'active' }, orderBy: { createdAt: 'asc' } }),
  );
  const active = memberships.find((m) => m.chamberId === session.activeChamberId) ?? memberships[0];
  if (!active) return null;
  if (active.chamberId !== session.activeChamberId) await setActiveChamber(session.id, active.chamberId);

  return {
    userId,
    chamberId: active.chamberId,
    membershipId: active.id,
    role: active.role,
    caseScope: active.caseScope,
    canSeeFees: active.canSeeFees,
  };
});

/**
 * Gate for every chamber screen and action. Sends people to the step they still need:
 * sign in → two-step code → chamber setup → owner two-step setup.
 */
export async function requireCtx(): Promise<Ctx> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.user.totpEnabledAt && !session.mfaVerifiedAt) redirect('/login/two-step');
  const ctx = await getCtx();
  if (!ctx) redirect('/onboarding');
  // Owners must turn on two-step verification after onboarding (plan.md section 8).
  if (ctx.role === 'owner' && !session.user.totpEnabledAt) redirect('/security/two-step');
  return ctx;
}
