import 'server-only';
import { headers } from 'next/headers';
import { keyedHash } from '@/server/crypto';

/** Client IP as a keyed hash (rate limits, audit). The raw IP is never stored. */
export async function requestIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip');
  return ip ? keyedHash(`ip:${ip}`) : null;
}

export async function requestUserAgent(): Promise<string | null> {
  return (await headers()).get('user-agent');
}
