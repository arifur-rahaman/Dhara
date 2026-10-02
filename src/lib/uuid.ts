import { randomBytes } from 'node:crypto';

/** UUID v7 (time-ordered, RFC 9562). Used when an id is needed before the row exists, e.g. to set the RLS context. */
export function uuidv7(): string {
  const bytes = randomBytes(16);
  // 48-bit millisecond timestamp, big-endian. Fits exactly in a double.
  const ms = Date.now();
  for (let i = 0; i < 6; i++) bytes[i] = Math.floor(ms / 2 ** (8 * (5 - i))) % 256;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
