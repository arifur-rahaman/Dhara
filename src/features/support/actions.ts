'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/server/audit';
import { assertCan } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';

/** Support access lasts 24 hours from approval (plan.md 3.2). The database refuses anything longer. */
const GRANT_MS = 24 * 60 * 60 * 1000;

type Decision = 'approve' | 'reject' | 'revoke';

async function decide(form: FormData, decision: Decision) {
  const ctx = await requireCtx();
  assertCan('approveSupportAccess', ctx);
  const id = z.uuid().parse(form.get('grantId'));
  const now = new Date();
  await withTenant(scopeOf(ctx), async (tx) => {
    const open = { id, chamberId: ctx.chamberId, rejectedAt: null, revokedAt: null };
    const where =
      decision === 'revoke'
        ? { ...open, approvedAt: { not: null }, expiresAt: { gt: now } }
        : { ...open, approvedAt: null };
    const data =
      decision === 'approve'
        ? { approvedAt: now, approvedBy: ctx.userId, expiresAt: new Date(now.getTime() + GRANT_MS) }
        : decision === 'reject'
          ? { rejectedAt: now }
          : { revokedAt: now };
    const { count } = await tx.supportGrant.updateMany({ where, data });
    if (count) {
      await audit(tx, {
        chamberId: ctx.chamberId,
        actorUserId: ctx.userId,
        action: `support.${decision}`,
        entity: 'support_grant',
        entityId: id,
      });
    }
  });
  redirect('/support');
}

export async function approveSupport(form: FormData) {
  await decide(form, 'approve');
}

export async function rejectSupport(form: FormData) {
  await decide(form, 'reject');
}

export async function revokeSupport(form: FormData) {
  await decide(form, 'revoke');
}
