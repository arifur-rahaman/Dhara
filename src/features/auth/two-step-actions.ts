'use server';

import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { audit } from '@/server/audit';
import { getSession } from '@/server/auth/session';
import { checkTotp, newRecoveryCodes, newTotpSecret, totpUri } from '@/server/auth/totp';
import { decryptField } from '@/server/crypto';
import { prisma } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import { maskPhone } from '@/lib/phone';

export type TwoStepSetupState =
  | { step: 'start' }
  | { step: 'scan'; secret: string; uri: string; qrSvg: string; error?: string }
  | { step: 'done'; recoveryCodes: string[] };

async function signedIn() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

async function scanState(secretEnc: string, phone: string, error?: string): Promise<TwoStepSetupState> {
  const secret = decryptField(secretEnc);
  const uri = totpUri(secret, maskPhone(phone));
  const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { step: 'scan', secret, uri, qrSvg, error };
}

/** Creates (or reuses) a pending secret. Two-step stays off until a code is confirmed. */
export async function startTwoStepSetup(): Promise<TwoStepSetupState> {
  const session = await signedIn();
  const user = session.user;
  if (user.totpEnabledAt) redirect('/today');
  let secretEnc = user.totpSecretEnc;
  if (!secretEnc) {
    secretEnc = newTotpSecret().secretEnc;
    await prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: secretEnc } });
  }
  return scanState(secretEnc, user.phone);
}

/** Confirms the first code, turns two-step on and returns recovery codes (shown once). */
export async function confirmTwoStepSetup(_: TwoStepSetupState, form: FormData): Promise<TwoStepSetupState> {
  const session = await signedIn();
  const user = session.user;
  if (user.totpEnabledAt) redirect('/today');
  if (!user.totpSecretEnc) return startTwoStepSetup();

  const result = await checkTotp(user.totpSecretEnc, String(form.get('code') ?? '').trim(), null);
  if (!result.ok) return scanState(user.totpSecretEnc, user.phone, 'codeInvalid');

  const { codes, hashes } = newRecoveryCodes();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabledAt: new Date(), totpLastStep: result.step, recoveryCodeHashes: hashes },
  });
  await prisma.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: new Date() } });
  await withTenant({}, (tx) =>
    audit(tx, {
      chamberId: null,
      actorUserId: user.id,
      action: 'auth.totp_enabled',
      entity: 'user',
      entityId: user.id,
    }),
  );
  return { step: 'done', recoveryCodes: codes };
}

/** Single form action for the setup screen: `intent=start` shows the QR code, `intent=confirm` checks the code. */
export async function twoStepSetupAction(prev: TwoStepSetupState, form: FormData): Promise<TwoStepSetupState> {
  return form.get('intent') === 'confirm' ? confirmTwoStepSetup(prev, form) : startTwoStepSetup();
}
