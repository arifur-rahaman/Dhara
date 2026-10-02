import 'server-only';
import { randomBytes } from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import { decryptField, encryptField, safeEqual, sha256 } from '@/server/crypto';

/** TOTP two-step verification (TECH_GUIDE section 5): required for owners and platform admins. */
export function newTotpSecret() {
  const secret = generateSecret();
  return { secret, secretEnc: encryptField(secret) };
}

export function totpUri(secret: string, account: string) {
  return generateURI({ issuer: 'Dhara', label: account, secret });
}

/** Checks a code; rejects reuse of an already accepted time step. */
export async function checkTotp(secretEnc: string, token: string, lastStep: bigint | null) {
  if (!/^\d{6}$/.test(token)) return { ok: false as const };
  const result = await verify({
    secret: decryptField(secretEnc),
    token,
    epochTolerance: 30,
    ...(lastStep !== null ? { afterTimeStep: Number(lastStep) } : {}),
  });
  // Step = start of the matched 30-second period / 30 (RFC 6238), stored to block reuse.
  return result.valid ? { ok: true as const, step: BigInt(Math.floor(result.epoch / 30)) } : { ok: false as const };
}

/** Ten one-time recovery codes, shown once. Only hashes are stored. */
export function newRecoveryCodes() {
  const codes = Array.from({ length: 10 }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(c)) };
}

export function matchRecoveryCode(hashes: string[], input: string): string | null {
  const h = sha256(input.trim().toUpperCase());
  return hashes.find((stored) => safeEqual(stored, h)) ?? null;
}
