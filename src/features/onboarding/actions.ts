'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { uuidv7 } from '@/lib/uuid';
import { audit } from '@/server/audit';
import { getSession, setActiveChamber } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import type { FormState } from '@/features/auth/actions';
import { districts } from './districts';

/** Version of the privacy notice the person agreed to; bump when the notice text changes. */
const PRIVACY_NOTICE_VERSION = '2026-10-v1';

async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.user.totpEnabledAt && !session.mfaVerifiedAt) redirect('/login/two-step');
  return session;
}

/** Consent step before any setup (Personal Data Protection Ordinance 2025; plan.md section 8). */
export async function acceptPrivacyNotice(_: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (form.get('agree') !== 'yes') return { error: 'consentRequired' };
  await prisma.user.update({
    where: { id: session.userId },
    data: { privacyConsentAt: new Date(), privacyConsentVersion: PRIVACY_NOTICE_VERSION },
  });
  redirect('/onboarding');
}

const chamberInput = z.object({
  chamberName: z.string().trim().min(2).max(120),
  yourName: z.string().trim().min(2).max(120),
  district: z.enum(districts),
});

/** Step 1 (Onboarding design): creates the chamber and the owner membership. */
export async function createChamber(_: FormState, form: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.user.privacyConsentAt) redirect('/onboarding');
  const values = {
    chamberName: String(form.get('chamberName') ?? ''),
    yourName: String(form.get('yourName') ?? ''),
    district: String(form.get('district') ?? ''),
  };
  const parsed = chamberInput.safeParse(values);
  if (!parsed.success) return { error: 'chamberInvalid', values };

  const userId = session.userId;
  const chamberId = uuidv7();
  await withTenant({ chamberId, userId }, async (tx) => {
    await tx.chamber.create({
      data: {
        id: chamberId,
        name: parsed.data.chamberName,
        district: parsed.data.district,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const membership = await tx.membership.create({ data: { chamberId, userId, role: 'owner', caseScope: 'all' } });
    await tx.user.update({ where: { id: userId }, data: { name: parsed.data.yourName } });
    await audit(tx, {
      chamberId,
      actorUserId: userId,
      action: 'chamber.create',
      entity: 'chamber',
      entityId: chamberId,
    });
    await audit(tx, {
      chamberId,
      actorUserId: userId,
      action: 'membership.create',
      entity: 'membership',
      entityId: membership.id,
      fields: { role: 'owner' },
    });
  });
  await setActiveChamber(session.id, chamberId);
  redirect('/onboarding/next');
}
