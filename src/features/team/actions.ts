'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { normalizeBdPhone } from '@/lib/phone';
import { audit } from '@/server/audit';
import { assertCan } from '@/server/authz';
import { getSession, setActiveChamber } from '@/server/auth/session';
import { requireCtx } from '@/server/context';
import { randomToken, sha256 } from '@/server/crypto';
import { withTenant } from '@/server/db/tenant';
import { env } from '@/server/env';
import { smsProvider, type E164 } from '@/server/providers/sms';
import type { FormState } from '@/features/auth/actions';
import { INVITE_COOKIE } from '@/features/auth/after-sign-in';
import { getPreferences } from '@/features/preferences/server';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const inviteInput = z.object({
  name: z.string().trim().min(2).max(120),
  role: z.enum(['associate', 'munshi', 'staff']),
  caseScope: z.enum(['all', 'assigned']),
});

/** Owner invites a member by SMS (InviteMember design). The role comes from here, never from the invitee. */
export async function inviteMember(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('inviteMember', ctx);

  const values = {
    name: String(form.get('name') ?? ''),
    phone: String(form.get('phone') ?? ''),
    role: String(form.get('role') ?? 'associate'),
    caseScope: String(form.get('caseScope') ?? 'assigned'),
  };
  const phone = normalizeBdPhone(values.phone);
  if (!phone) return { error: 'phoneInvalid', values };
  const parsed = inviteInput.safeParse(values);
  if (!parsed.success) return { error: 'inviteInvalid', values };
  // Case scope only matters for associates (P3); munshi see all cases and staff see today's list.
  const caseScope = parsed.data.role === 'associate' ? parsed.data.caseScope : 'all';

  const token = randomToken();
  const outcome = await withTenant({ chamberId: ctx.chamberId, userId: ctx.userId }, async (tx) => {
    const existing = await tx.membership.findFirst({
      where: { chamberId: ctx.chamberId, status: 'active', user: { phone } },
    });
    if (existing) return 'alreadyMember' as const;
    await tx.invitation.updateMany({
      where: { chamberId: ctx.chamberId, phone, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const invitation = await tx.invitation.create({
      data: {
        chamberId: ctx.chamberId,
        phone,
        name: parsed.data.name,
        role: parsed.data.role,
        caseScope,
        tokenHash: sha256(token),
        invitedBy: ctx.userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    await audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'invitation.create',
      entity: 'invitation',
      entityId: invitation.id,
      fields: { role: parsed.data.role, caseScope },
    });
    const chamber = await tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { name: true } });
    return { invitationId: invitation.id, chamberName: chamber.name };
  });
  if (outcome === 'alreadyMember') return { error: 'alreadyMember', values };

  const link = `${env().APP_URL}/invite/${token}`;
  const { locale } = await getPreferences();
  const text =
    locale === 'bn'
      ? `${outcome.chamberName} আপনাকে ধারা অ্যাপে ইনভাইট করেছে। ৭ দিনের মধ্যে খুলুন: ${link}`
      : `${outcome.chamberName} invited you to Dhara. Open within 7 days: ${link}`;
  await smsProvider().send(phone as E164, text, `invite-${outcome.invitationId}`);
  redirect('/team?invited=1');
}

/** Owner withdraws an open invitation. */
export async function revokeInvitation(form: FormData) {
  const ctx = await requireCtx();
  assertCan('inviteMember', ctx);
  const id = z.uuid().parse(form.get('invitationId'));
  await withTenant({ chamberId: ctx.chamberId, userId: ctx.userId }, async (tx) => {
    const updated = await tx.invitation.updateMany({
      where: { id, chamberId: ctx.chamberId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count) {
      await audit(tx, {
        chamberId: ctx.chamberId,
        actorUserId: ctx.userId,
        action: 'invitation.revoke',
        entity: 'invitation',
        entityId: id,
      });
    }
  });
  redirect('/team');
}

/** Visitor without a session: remember the invitation, then sign in. */
export async function continueInviteToSignIn(form: FormData) {
  const token = z
    .string()
    .regex(/^[\w-]{20,100}$/)
    .parse(form.get('token'));
  (await cookies()).set(INVITE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  redirect('/login');
}

/**
 * Accepts an invitation, either by its token (SMS link) or by id when it was sent to the signed-in phone.
 * The signed-in phone must match the invited phone.
 */
export async function acceptInvitation(form: FormData) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.user.totpEnabledAt && !session.mfaVerifiedAt) redirect('/login/two-step');
  // Invitees agree to the privacy notice too; onboarding shows it, then lists their open invitations.
  if (!session.user.privacyConsentAt) redirect('/onboarding');
  const user = session.user;

  const token = form.get('token');
  const invitationId = form.get('invitationId');
  const scope = typeof token === 'string' && token ? { inviteTokenHash: sha256(token) } : { userPhone: user.phone };

  const invitation = await withTenant({ ...scope, userId: user.id }, (tx) =>
    tx.invitation.findFirst({
      where: {
        ...(typeof token === 'string' && token ? { tokenHash: sha256(token) } : { id: z.uuid().parse(invitationId) }),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  );
  if (!invitation || invitation.phone !== user.phone) redirect('/onboarding');

  await withTenant({ chamberId: invitation.chamberId, userId: user.id }, async (tx) => {
    const membership = await tx.membership.upsert({
      where: { chamberId_userId: { chamberId: invitation.chamberId, userId: user.id } },
      create: {
        chamberId: invitation.chamberId,
        userId: user.id,
        role: invitation.role,
        caseScope: invitation.caseScope,
      },
      update: { role: invitation.role, caseScope: invitation.caseScope, status: 'active' },
    });
    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
    if (!user.name) await tx.user.update({ where: { id: user.id }, data: { name: invitation.name } });
    await audit(tx, {
      chamberId: invitation.chamberId,
      actorUserId: user.id,
      action: 'invitation.accept',
      entity: 'invitation',
      entityId: invitation.id,
      fields: { role: invitation.role, membershipId: membership.id },
    });
  });
  (await cookies()).delete(INVITE_COOKIE);
  await setActiveChamber(session.id, invitation.chamberId);
  redirect('/today');
}
