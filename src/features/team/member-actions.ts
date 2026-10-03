'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { audit } from '@/server/audit';
import { assertCan } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import type { FormState } from '@/features/auth/actions';

const memberInput = z.object({
  membershipId: z.uuid(),
  role: z.enum(['associate', 'munshi', 'staff']),
  caseScope: z.enum(['all', 'assigned']),
  canSeeFees: z.boolean(),
});

/**
 * Owner changes a member's role and the adjustable rules (plan.md 3.1): associate case scope (P3)
 * and fee visibility per associate (P9). The owner's own membership is never changed here (P10).
 */
export async function updateMember(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('manageTeam', ctx);
  const values = {
    role: String(form.get('role') ?? ''),
    caseScope: String(form.get('caseScope') ?? 'assigned'),
    canSeeFees: form.get('canSeeFees') === 'on' ? 'on' : '',
  };
  const parsed = memberInput.safeParse({
    membershipId: form.get('membershipId'),
    role: values.role,
    caseScope: values.caseScope,
    canSeeFees: values.canSeeFees === 'on',
  });
  if (!parsed.success) return { error: 'memberInvalid', values };
  const { membershipId, role } = parsed.data;
  // Scope and fees only apply to associates; munshi see all cases, staff see today's list.
  const caseScope = role === 'associate' ? parsed.data.caseScope : 'all';
  const canSeeFees = role === 'associate' ? parsed.data.canSeeFees : false;

  const result = await withTenant(scopeOf(ctx), async (tx) => {
    const member = await tx.membership.findFirst({
      where: { id: membershipId, chamberId: ctx.chamberId, status: 'active' },
    });
    if (!member || member.role === 'owner') return 'notFound' as const;
    if (member.role === role && member.caseScope === caseScope && member.canSeeFees === canSeeFees) return 'ok';
    await tx.membership.update({ where: { id: member.id }, data: { role, caseScope, canSeeFees } });
    if (member.role !== role) {
      await audit(tx, {
        chamberId: ctx.chamberId,
        actorUserId: ctx.userId,
        action: 'membership.role_change',
        entity: 'membership',
        entityId: member.id,
        fields: { from: member.role, to: role },
      });
    }
    if (member.caseScope !== caseScope || member.canSeeFees !== canSeeFees) {
      await audit(tx, {
        chamberId: ctx.chamberId,
        actorUserId: ctx.userId,
        action: 'membership.permission_change',
        entity: 'membership',
        entityId: member.id,
        fields: {
          caseScope: { from: member.caseScope, to: caseScope },
          canSeeFees: { from: member.canSeeFees, to: canSeeFees },
        },
      });
    }
    return 'ok';
  });
  if (result === 'notFound') return { error: 'memberInvalid', values };
  redirect('/team?saved=1');
}

/** Owner removes a member from the chamber. Their cases and tasks stay for the owner to reassign. */
export async function removeMember(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('manageTeam', ctx);
  const membershipId = z.uuid().safeParse(form.get('membershipId'));
  if (!membershipId.success) return { error: 'memberInvalid' };
  if (form.get('confirm') !== 'on') return { error: 'confirmRemove' };

  const done = await withTenant(scopeOf(ctx), async (tx) => {
    const member = await tx.membership.findFirst({
      where: { id: membershipId.data, chamberId: ctx.chamberId, status: 'active' },
    });
    if (!member || member.role === 'owner') return false;
    await tx.membership.update({ where: { id: member.id }, data: { status: 'revoked' } });
    await audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'membership.revoke',
      entity: 'membership',
      entityId: member.id,
      fields: { role: member.role },
    });
    return true;
  });
  if (!done) return { error: 'memberInvalid' };
  redirect('/team?removed=1');
}
