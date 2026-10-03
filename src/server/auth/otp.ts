import 'server-only';
import { randomInt } from 'node:crypto';
import { keyedHash, safeEqual } from '@/server/crypto';
import { prisma } from '@/server/db/client';
import { env } from '@/server/env';
import { smsProvider, type E164 } from '@/server/providers/sms';

/** plan.md section 8: 6 digits, 5-minute expiry, attempt limit, rate limit per phone and IP. */
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_PHONE = 3;

const codeHash = (phone: string, code: string) => keyedHash(`otp:${phone}:${code}`);

export type RequestOtpResult = { ok: true; challengeId: string } | { ok: false; reason: 'rate_limited' };

export async function requestOtp(
  phone: E164,
  opts: { ipHash: string | null; locale: 'en' | 'bn' },
): Promise<RequestOtpResult> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byPhone, byIp] = await Promise.all([
    prisma.otpChallenge.count({ where: { phone, createdAt: { gte: since } } }),
    opts.ipHash ? prisma.otpChallenge.count({ where: { ipHash: opts.ipHash, createdAt: { gte: since } } }) : 0,
  ]);
  if (byPhone >= MAX_PER_PHONE || byIp >= env().OTP_LIMIT_PER_IP) return { ok: false, reason: 'rate_limited' };

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge = await prisma.otpChallenge.create({
    data: { phone, codeHash: codeHash(phone, code), ipHash: opts.ipHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  const text =
    opts.locale === 'bn'
      ? `ধারা লগইন কোড: ${code}। ৫ মিনিট কাজ করবে। কাউকে বলবেন না।`
      : `Dhara sign-in code: ${code}. Valid for 5 minutes. Do not share it.`;
  await smsProvider().send(phone, text, `otp-${challenge.id}`);
  return { ok: true, challengeId: challenge.id };
}

export type VerifyOtpResult =
  { ok: true; phone: E164 } | { ok: false; reason: 'invalid' | 'expired' | 'too_many_attempts' };

export async function verifyOtp(challengeId: string, code: string): Promise<VerifyOtpResult> {
  const challenge = await prisma.otpChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  // Count the attempt first, atomically, so parallel guesses cannot exceed the limit.
  const counted = await prisma.otpChallenge.updateMany({
    where: { id: challengeId, attempts: { lt: OTP_MAX_ATTEMPTS }, consumedAt: null },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) return { ok: false, reason: 'too_many_attempts' };

  if (!safeEqual(codeHash(challenge.phone, code), challenge.codeHash)) return { ok: false, reason: 'invalid' };

  const consumed = await prisma.otpChallenge.updateMany({
    where: { id: challengeId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) return { ok: false, reason: 'expired' };
  return { ok: true, phone: challenge.phone as E164 };
}
