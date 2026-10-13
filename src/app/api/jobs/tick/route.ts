import { NextResponse } from 'next/server';
import { safeEqual } from '@/server/crypto';
import { env } from '@/server/env';
import { runNoticeTick, runReminderTick } from '@/server/jobs/reminders';

/**
 * The background tick for hosts without a long-running worker (Vercel): a scheduler calls this every
 * minute with `Authorization: Bearer <CRON_SECRET>`. It does what the pg-boss worker does each minute.
 * A missed minute is caught up on the next call (recentMinutes), and every claim happens once, so an extra
 * or repeated call is safe. Without CRON_SECRET the route does not exist.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  const given = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secret || secret.length < 32 || !safeEqual(given, secret)) {
    return new NextResponse('Not found', { status: 404 });
  }
  const reminders = await runReminderTick();
  const notices = await runNoticeTick();
  return NextResponse.json({ reminders, notices });
}
