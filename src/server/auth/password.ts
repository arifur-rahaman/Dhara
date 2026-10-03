import 'server-only';
import { hash, verify } from '@node-rs/argon2';

// Argon2id (TECH_GUIDE section 5). 2 = Algorithm.Argon2id; the const enum cannot be imported with isolatedModules.
const options = { algorithm: 2 as const, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const PASSWORD_MIN_LENGTH = 8;

export function hashPassword(password: string) {
  return hash(password, options);
}

export async function verifyPassword(stored: string, password: string) {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** Same cost as a real check, so phone numbers without a password cannot be told apart by timing. */
let dummy: Promise<string> | undefined;
export async function verifyPasswordOrDummy(stored: string | null | undefined, password: string) {
  dummy ??= hashPassword('dhara-timing-equaliser');
  const ok = await verifyPassword(stored ?? (await dummy), password);
  return ok && !!stored;
}
