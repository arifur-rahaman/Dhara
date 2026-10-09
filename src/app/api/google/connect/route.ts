import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCtx } from '@/server/context';
import { randomToken } from '@/server/crypto';
import { env } from '@/server/env';
import { authUrl, calendarEnabled } from '@/server/providers/google-calendar';

const STATE_COOKIE = 'dhara_gstate';

/** Starts Google sign-in for calendar access (F8). The state value ties the reply to this browser. */
export async function GET() {
  const ctx = await getCtx();
  if (!ctx || !calendarEnabled()) return new NextResponse('Not found', { status: 404 });
  const state = randomToken(24);
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/google',
    maxAge: 600,
  });
  return NextResponse.redirect(authUrl(state, `${env().APP_URL}/api/google/callback`));
}
