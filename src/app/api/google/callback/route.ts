import { after } from 'next/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCtx } from '@/server/context';
import { encryptField, safeEqual } from '@/server/crypto';
import { withTenant } from '@/server/db/tenant';
import { env } from '@/server/env';
import { calendarEnabled, exchangeCode } from '@/server/providers/google-calendar';
import { syncMyCalendar } from '@/features/calendar-sync/sync';

const STATE_COOKIE = 'dhara_gstate';

/** Google's reply (F8): checks the state, keeps only the encrypted refresh token, then syncs once. */
export async function GET(request: Request) {
  const ctx = await getCtx();
  const back = (status: string) => NextResponse.redirect(new URL(`/settings?calendar=${status}`, env().APP_URL));
  if (!ctx || !calendarEnabled()) return new NextResponse('Not found', { status: 404 });
  const q = new URL(request.url).searchParams;
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value ?? '';
  store.delete({ name: STATE_COOKIE, path: '/api/google' });
  const code = q.get('code');
  if (!code || !expected || !safeEqual(q.get('state') ?? '', expected)) return back('failed');
  try {
    const { refreshToken } = await exchangeCode(code, `${env().APP_URL}/api/google/callback`);
    await withTenant({ userId: ctx.userId }, (tx) =>
      tx.calendarLink.upsert({
        where: { userId: ctx.userId },
        create: { userId: ctx.userId, refreshTokenEnc: encryptField(refreshToken) },
        update: { refreshTokenEnc: encryptField(refreshToken), lastSyncedAt: null },
      }),
    );
  } catch {
    return back('failed');
  }
  after(() => syncMyCalendar(ctx, { force: true }));
  return back('connected');
}
