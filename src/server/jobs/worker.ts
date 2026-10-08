import 'server-only';
import { PgBoss } from 'pg-boss';
import { env } from '@/server/env';
import { runReminderTick } from './reminders';

/**
 * Background jobs (TECH_GUIDE section 12) on pg-boss, in Postgres (schema pgboss, owned by dhara_jobs).
 * Started from instrumentation.ts when RUN_JOBS=1, so the same image runs as the app or as the worker.
 * The tick runs every minute; reminder_log makes a repeated or late tick safe.
 */
export async function startWorker() {
  const url = env().DATABASE_JOBS_URL;
  if (!url) throw new Error('RUN_JOBS=1 needs DATABASE_JOBS_URL');
  // The migration creates schema pgboss owned by dhara_jobs, so the role needs no database-wide CREATE right.
  const boss = new PgBoss({ connectionString: url, schema: 'pgboss', createSchema: false });
  boss.on('error', (e) => console.error('[jobs] error', e instanceof Error ? e.message : e));
  await boss.start();
  await boss.createQueue('reminders.tick');
  await boss.schedule('reminders.tick', '* * * * *', null, { tz: 'Asia/Dhaka' });
  await boss.work('reminders.tick', async () => {
    const sent = await runReminderTick();
    if (sent) console.info(`[jobs] reminders sent: ${sent}`);
  });
  console.info('[jobs] worker started');
  return boss;
}
