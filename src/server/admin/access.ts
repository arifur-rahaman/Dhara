/**
 * Where the admin portal may be opened (TECH_GUIDE section 5: separate origin, IP allowlist).
 * Used by src/proxy.ts and again by the admin layout, so a misrouted request is still refused.
 * No server-only import: the proxy runs this too.
 */
export function adminHost(env = process.env): string | null {
  const host = hostOf(env.ADMIN_URL);
  // Same host as the chamber app means no separate admin origin (local development).
  return host && host !== hostOf(env.APP_URL) ? host : null;
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** Without ADMIN_URL the portal is only served in development, on the app's own host. */
export function adminPortalAllowedOnHost(host: string | null, env = process.env): boolean {
  const expected = adminHost(env);
  if (!expected) return env.NODE_ENV !== 'production';
  return host === expected;
}

/**
 * ADMIN_IP_ALLOWLIST: comma-separated IP addresses or IPv4 CIDR ranges. Empty means no restriction in development
 * and no access at all in production (fail closed).
 * The client IP comes from the first X-Forwarded-For entry, so the reverse proxy in front of the app must set it.
 */
export function ipAllowed(ip: string | null, env = process.env): boolean {
  const list = (env.ADMIN_IP_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return env.NODE_ENV !== 'production';
  return !!ip && list.some((entry) => matches(ip, entry));
}

function matches(ip: string, entry: string): boolean {
  const [base, bits] = entry.split('/');
  if (bits === undefined) return ip === base;
  const a = ipv4(ip);
  const b = ipv4(base);
  const n = Number(bits);
  if (a === null || b === null || !Number.isInteger(n) || n < 0 || n > 32) return false;
  const mask = n === 0 ? 0 : (0xffffffff << (32 - n)) >>> 0;
  return (a & mask) >>> 0 === (b & mask) >>> 0;
}

function ipv4(value: string): number | null {
  const parts = value.replace(/^::ffff:/, '').split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return null;
  return parts.reduce((acc, p) => ((acc << 8) | Number(p)) >>> 0, 0);
}

export function clientIp(headers: Headers): string | null {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || null;
}
