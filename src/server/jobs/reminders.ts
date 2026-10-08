import 'server-only';
import pg from 'pg';
import { createTranslator } from 'next-intl';
import { intlLocale, isLocale, isNumerals, type Locale } from '@/i18n/config';
import en from '@/i18n/en.json';
import bn from '@/i18n/bn.json';
import { env } from '@/server/env';
import { sendPush, type PushMessage } from '@/server/providers/push';
import { recentMinutes } from './clock';

/**
 * Night and morning reminders (F5). Runs as dhara_jobs, which can only call jobs_claim_reminders():
 * it gets counts per person, never names or case numbers, and each person's reminder is claimed once a day.
 */
let pool: pg.Pool | null = null;
function jobsPool() {
  const url = env().DATABASE_JOBS_URL;
  if (!url) throw new Error('DATABASE_JOBS_URL is not set. See .env.example.');
  pool ??= new pg.Pool({ connectionString: url, max: 2 });
  return pool;
}

type Claimed = { user_id: string; hearings: number; tasks: number; locale: string | null; numerals: string | null };

export function reminderMessage(
  kind: 'night' | 'morning',
  c: { hearings: number; tasks: number; locale: string | null; numerals: string | null },
): PushMessage {
  const locale: Locale = isLocale(c.locale) ? c.locale : 'bn';
  const numerals = isNumerals(c.numerals) ? c.numerals : 'bn';
  const t = createTranslator({
    locale: intlLocale(locale, numerals),
    messages: locale === 'bn' ? bn : en,
    namespace: 'push',
  });
  const body =
    kind === 'night'
      ? t('night', { hearings: c.hearings })
      : c.tasks > 0
        ? t('morningWithTasks', { hearings: c.hearings, tasks: c.tasks })
        : t('morning', { hearings: c.hearings });
  return { title: t('title'), body, url: '/today', tag: `reminder-${kind}` };
}

export async function runReminderTick(now = new Date()) {
  const db = jobsPool();
  let sent = 0;
  for (const minute of recentMinutes(now)) {
    for (const kind of ['night', 'morning'] as const) {
      const { rows } = await db.query<Claimed>('SELECT * FROM jobs_claim_reminders($1, $2, $3::date)', [
        kind,
        minute.hhmm,
        minute.date,
      ]);
      for (const row of rows) sent += await deliver(db, row.user_id, reminderMessage(kind, row));
    }
  }
  return sent;
}

async function deliver(db: pg.Pool, userId: string, message: PushMessage) {
  const { rows } = await db.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );
  let sent = 0;
  for (const sub of rows) {
    const result = await sendPush(sub, message);
    if (result === 'sent') {
      sent++;
      await db.query('UPDATE push_subscriptions SET last_success_at = now() WHERE id = $1', [sub.id]);
    } else if (result === 'gone') {
      await db.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
    }
  }
  return sent;
}
