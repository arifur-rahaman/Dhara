import 'server-only';
import { env } from '@/server/env';

/**
 * Google Calendar adapter (F8, TECH_GUIDE section 15). OAuth 2.0 authorization code flow with offline access,
 * one scope, and the Calendar v3 events API. `fetchImpl` is replaceable so tests never call Google.
 */
export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';

export type CalendarEventInput = {
  summary: string;
  description: string;
  date: string; // YYYY-MM-DD, an all-day event
  hearingId: string;
};

let fetchImpl: typeof fetch = (...args) => fetch(...args);
export function setGoogleFetch(f: typeof fetch) {
  fetchImpl = f;
}

export function calendarEnabled() {
  const e = env();
  return e.FEATURE_GOOGLE_CALENDAR === '1' && !!e.GOOGLE_CLIENT_ID && !!e.GOOGLE_CLIENT_SECRET;
}

export function authUrl(state: string, redirectUri: string) {
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state,
  }).toString();
  return u.toString();
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env().GOOGLE_CLIENT_ID!,
      client_secret: env().GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; scope?: string };
}

export async function exchangeCode(code: string, redirectUri: string) {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  if (!t.refresh_token) throw new Error('Google did not return a refresh token');
  if (t.scope && !t.scope.split(' ').includes(GOOGLE_SCOPE)) throw new Error('Calendar permission was not granted');
  return { refreshToken: t.refresh_token, accessToken: t.access_token };
}

export async function accessToken(refreshToken: string) {
  return (await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' })).access_token;
}

export async function revoke(refreshToken: string) {
  await fetchImpl(`${REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(() => undefined);
}

function nextDay(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Creates or updates one all-day event. Returns the event id, or null when an old id no longer exists. */
export async function upsertEvent(token: string, calendarId: string, eventId: string | null, ev: CalendarEventInput) {
  const body = JSON.stringify({
    summary: ev.summary,
    description: ev.description,
    start: { date: ev.date },
    end: { date: nextDay(ev.date) },
    transparency: 'transparent',
    extendedProperties: { private: { dharaHearingId: ev.hearingId } },
  });
  const base = `${API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await fetchImpl(eventId ? `${base}/${encodeURIComponent(eventId)}` : base, {
    method: eventId ? 'PUT' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
  });
  if (eventId && (res.status === 404 || res.status === 410)) return null;
  if (!res.ok) throw new Error(`Google Calendar request failed: ${res.status}`);
  return ((await res.json()) as { id: string }).id;
}
