'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { normalizeBdPhone } from '@/lib/phone';
import { audit } from '@/server/audit';
import { clearFailures, recordFailure, tooManyFailures } from '@/server/auth/attempts';
import { requestOtp, verifyOtp } from '@/server/auth/otp';
import { verifyPasswordOrDummy } from '@/server/auth/password';
import { createSession, endSession, getSession, markMfaVerified } from '@/server/auth/session';
import { checkTotp, matchRecoveryCode } from '@/server/auth/totp';
import { prisma } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import type { E164 } from '@/server/providers/sms';
import { requestIpHash, requestUserAgent } from '@/server/request';
import { getPreferences } from '@/features/preferences/server';
import { afterSignInPath } from './after-sign-in';

export type FormState = { error?: string; values?: Record<string, string> } | undefined;

async function signIn(userId: string, totpEnabled: boolean) {
  await createSession(userId, { mfaVerified: !totpEnabled, userAgent: await requestUserAgent() });
  await withTenant({}, (tx) =>
    audit(tx, { chamberId: null, actorUserId: userId, action: 'auth.sign_in', entity: 'user', entityId: userId }),
  );
  redirect(totpEnabled ? '/login/two-step' : await afterSignInPath());
}

/** Step 1 of phone sign-in: send a 6-digit code by SMS. */
export async function sendOtp(_: FormState, form: FormData): Promise<FormState> {
  const raw = String(form.get('phone') ?? '');
  const phone = normalizeBdPhone(raw);
  if (!phone) return { error: 'phoneInvalid', values: { phone: raw } };
  const { locale } = await getPreferences();
  const result = await requestOtp(phone as E164, { ipHash: await requestIpHash(), locale });
  if (!result.ok) return { error: 'rateLimited', values: { phone: raw } };
  redirect(`/login/verify?c=${result.challengeId}`);
}

/** Step 2: check the code; first sign-in creates the person. */
export async function verifyCode(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z
    .object({ challenge: z.uuid(), code: z.string().regex(/^\d{6}$/) })
    .safeParse({ challenge: form.get('challenge'), code: String(form.get('code') ?? '').trim() });
  if (!parsed.success) return { error: 'codeInvalid' };

  const result = await verifyOtp(parsed.data.challenge, parsed.data.code);
  if (!result.ok)
    return {
      error:
        result.reason === 'invalid' ? 'codeInvalid' : result.reason === 'expired' ? 'codeExpired' : 'tooManyAttempts',
    };

  const user =
    (await prisma.user.findUnique({ where: { phone: result.phone } })) ??
    (await prisma.user.create({ data: { phone: result.phone } }));
  await signIn(user.id, !!user.totpEnabledAt);
}

/** Password sign-in for people who set one in Settings. */
export async function signInWithPassword(_: FormState, form: FormData): Promise<FormState> {
  const raw = String(form.get('phone') ?? '');
  const phone = normalizeBdPhone(raw);
  const password = String(form.get('password') ?? '');
  if (!phone || !password) return { error: 'credentialsInvalid', values: { phone: raw } };

  const key = `password:${phone}`;
  if (await tooManyFailures(key)) return { error: 'tooManyAttempts', values: { phone: raw } };
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!(await verifyPasswordOrDummy(user?.passwordHash, password)) || !user) {
    await recordFailure(key);
    return { error: 'credentialsInvalid', values: { phone: raw } };
  }
  await clearFailures(key);
  await signIn(user.id, !!user.totpEnabledAt);
}

/** Second step for people with two-step verification on: authenticator code or a recovery code. */
export async function verifyTwoStep(_: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect('/login');
  const user = session.user;
  if (!user.totpEnabledAt || !user.totpSecretEnc) redirect(await afterSignInPath());

  const key = `totp:${user.id}`;
  if (await tooManyFailures(key)) return { error: 'tooManyAttempts' };
  const input = String(form.get('code') ?? '').replace(/\s/g, '');

  const totp = await checkTotp(user.totpSecretEnc, input, user.totpLastStep);
  if (totp.ok) {
    await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: totp.step } });
  } else {
    const used = matchRecoveryCode(user.recoveryCodeHashes, input);
    if (!used) {
      await recordFailure(key);
      return { error: 'codeInvalid' };
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { recoveryCodeHashes: user.recoveryCodeHashes.filter((h) => h !== used) },
    });
  }
  await clearFailures(key);
  await markMfaVerified(session.id);
  redirect(await afterSignInPath());
}

export async function signOut() {
  const session = await getSession();
  if (session) {
    await withTenant({}, (tx) =>
      audit(tx, {
        chamberId: null,
        actorUserId: session.userId,
        action: 'auth.sign_out',
        entity: 'user',
        entityId: session.userId,
      }),
    );
  }
  await endSession();
  redirect('/login');
}
