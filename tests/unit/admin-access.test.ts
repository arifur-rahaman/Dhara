import { describe, expect, it } from 'vitest';
import { adminPortalAllowedOnHost, clientIp, ipAllowed } from '@/server/admin/access';

const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;
const dev = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;

describe('admin portal host', () => {
  it('only answers on ADMIN_URL when it is set', () => {
    const env = { ...prod, ADMIN_URL: 'https://admin.dhara.example' };
    expect(adminPortalAllowedOnHost('admin.dhara.example', env)).toBe(true);
    expect(adminPortalAllowedOnHost('app.dhara.example', env)).toBe(false);
    expect(adminPortalAllowedOnHost(null, env)).toBe(false);
  });

  it('ADMIN_URL on the app host counts as unset', () => {
    const env = { ...prod, APP_URL: 'https://dhara.example', ADMIN_URL: 'https://dhara.example/admin' };
    expect(adminPortalAllowedOnHost('dhara.example', env)).toBe(false);
  });

  it('without ADMIN_URL: development only', () => {
    expect(adminPortalAllowedOnHost('localhost:3000', dev)).toBe(true);
    expect(adminPortalAllowedOnHost('app.dhara.example', prod)).toBe(false);
  });
});

describe('admin IP allowlist', () => {
  it('allows only listed addresses', () => {
    const env = { ...prod, ADMIN_IP_ALLOWLIST: '203.0.113.5, 198.51.100.7' };
    expect(ipAllowed('203.0.113.5', env)).toBe(true);
    expect(ipAllowed('198.51.100.7', env)).toBe(true);
    expect(ipAllowed('203.0.113.6', env)).toBe(false);
    expect(ipAllowed(null, env)).toBe(false);
  });

  it('matches IPv4 CIDR ranges', () => {
    const env = { ...prod, ADMIN_IP_ALLOWLIST: '127.0.0.1/32, 10.20.0.0/16' };
    expect(ipAllowed('127.0.0.1', env)).toBe(true);
    expect(ipAllowed('::ffff:127.0.0.1', env)).toBe(true);
    expect(ipAllowed('10.20.255.1', env)).toBe(true);
    expect(ipAllowed('10.21.0.1', env)).toBe(false);
    expect(ipAllowed('127.0.0.2', env)).toBe(false);
  });

  it('an empty list fails closed in production and is open in development', () => {
    expect(ipAllowed('203.0.113.5', prod)).toBe(false);
    expect(ipAllowed('203.0.113.5', dev)).toBe(true);
  });

  it('takes the first X-Forwarded-For entry', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIp(new Headers())).toBeNull();
  });
});
