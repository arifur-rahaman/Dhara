import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
process.env.FEATURE_GOOGLE_CALENDAR = '1';
process.env.GOOGLE_CLIENT_ID = 'cid';
process.env.GOOGLE_CLIENT_SECRET = 'secret';
const g = await import('@/server/providers/google-calendar');

describe('Google Calendar OAuth (F8)', () => {
  it('asks for one scope, offline access and carries the state', () => {
    const url = new URL(g.authUrl('state-123', 'https://dhara.example/api/google/callback'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.events');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('redirect_uri')).toBe('https://dhara.example/api/google/callback');
  });

  it('refuses a reply without calendar permission or without a refresh token', async () => {
    g.setGoogleFetch(async () => Response.json({ access_token: 'a', refresh_token: 'r', scope: 'openid email' }));
    await expect(g.exchangeCode('code', 'https://x/cb')).rejects.toThrow(/Calendar permission/);
    g.setGoogleFetch(async () => Response.json({ access_token: 'a' }));
    await expect(g.exchangeCode('code', 'https://x/cb')).rejects.toThrow(/refresh token/);
    g.setGoogleFetch(async () => Response.json({ access_token: 'a', refresh_token: 'r', scope: g.GOOGLE_SCOPE }));
    await expect(g.exchangeCode('code', 'https://x/cb')).resolves.toEqual({ refreshToken: 'r', accessToken: 'a' });
  });

  it('is off unless the flag and the credentials are all set', () => {
    expect(g.calendarEnabled()).toBe(true);
  });
});
