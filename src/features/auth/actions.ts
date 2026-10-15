'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { normalizeEmail } from '@/lib/email';
import { normalizeBdPhone } from '@/lib/phone';
import { audit } from '@/server/audit';
import { clearFailures, recordFailure, tooManyFailures } from '@/server/auth/attempts';
import { requestOtp, verifyOtp } from '@/server/auth/otp';
import { verifyPasswordOrDummy } from '@/server/auth/password';
import { createSession, endSession, getSession, markMfaVerified } from '@/server/auth/session';
import { checkTotp, matchRecoveryCode } from '@/server/auth/totp';
import { prisma } from '@/server/db/client';
import { env } from '@/server/env';
import { withTenant } from '@/server/db/tenant';
import type { E164 } from '@/server/providers/sms';
import { requestIpHash, requestUserAgent } from '@/server/request';
import { getPreferences } from '@/features/preferences/server';
import { afterSignInPath } from './after-sign-in';

export type FormState =
  | {
      error?: string;
      values?: Record<string, string>;
      ok?: boolean;
      at?: number;
      /** Email login: a new number is asked for an email address before the code is sent. */
      step?: 'email';
      /** Invitations without SMS: the link the owner shares from their own phone. */
      link?: string;
    }
  | undefined;

async function signIn(userId: string, totpEnabled: boolean) {
  await createSession(userId, { mfaVerified: !totpEnabled, userAgent: await requestUserAgent() });
  await withTenant({}, (tx) =>
    audit(tx, { chamberId: null, actorUserId: userId, action: 'auth.sign_in', entity: 'user', entityId: userId }),
  );
  redirect(totpEnabled ? '/login/two-step' : await afterSignInPath());
}

/**
 * Step 1 of phone sign-in: send a 6-digit code by SMS, or by email when OTP_CHANNEL=email.
 * With email, a known number gets the code at its saved address. A new number is asked for an address
 * first. A known number without one must use its password, so nobody can attach their own address to
 * someone else's account.
 */
export async function sendOtp(_: FormState, form: FormData): Promise<FormState> {
  const raw = String(form.get('phone') ?? '');
  const phone = normalizeBdPhone(raw);
  if (!phone) return { error: 'phoneInvalid', values: { phone: raw } };
  const { locale } = await getPreferences();
  const ipHash = await requestIpHash();

  let email: string | undefined;
  if (env().OTP_CHANNEL === 'email') {
    const user = await prisma.user.findUnique({ where: { phone }, select: { email: true } });
    if (user?.email) {
      email = user.email;
    } else if (user) {
      return { error: 'noEmailUsePassword', values: { phone: raw } };
    } else {
      const rawEmail = form.get('email');
      if (typeof rawEmail !== 'string') return { step: 'email', values: { phone: raw } };
      const normalized = normalizeEmail(rawEmail);
      if (!normalized) return { step: 'email', error: 'emailInvalid', values: { phone: raw, email: rawEmail } };
      if (await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } })) {
        return { step: 'email', error: 'emailTaken', values: { phone: raw, email: rawEmail } };
      }
      email = normalized;
    }
  }

  let result: Awaited<ReturnType<typeof requestOtp>>;
  try {
    result = await requestOtp(phone as E164, { ipHash, locale, email });
  } catch (error) {
    // The email or SMS service refused or is not configured. Never log the address or the code.
    console.error(`[auth] sign-in code not sent: ${error instanceof Error ? error.message : 'unknown error'}`);
    const typed = form.get('email');
    return typeof typed === 'string'
      ? { error: 'sendFailed', step: 'email', values: { phone: raw, email: typed } }
      : { error: 'sendFailed', values: { phone: raw } };
  }
  if (!result.ok) return { error: 'rateLimited', step: email ? 'email' : undefined, values: { phone: raw } };
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

  // An SMS code proves the phone; an email code proves the address (and creates the person with it).
  const proof = result.email ? { email: result.email, emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() };
  let user = await prisma.user.findUnique({ where: { phone: result.phone } });
  if (user) {
    // The code went to the address this account already has; anything else is refused.
    if (result.email && user.email !== result.email) return { error: 'codeExpired' };
    if (result.email ? !user.emailVerifiedAt : !user.phoneVerifiedAt) {
      user = await prisma.user.update({ where: { id: user.id }, data: proof });
    }
  } else {
    try {
      user = await prisma.user.create({ data: { phone: result.phone, ...proof } });
    } catch {
      return { error: 'codeExpired' }; // the address was taken in the meantime
    }
  }
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
