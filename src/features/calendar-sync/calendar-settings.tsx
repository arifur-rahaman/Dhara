import { getTranslations } from 'next-intl/server';
import { formatDate } from '@/i18n/format';
import type { Ctx } from '@/server/authz';
import { withTenant } from '@/server/db/tenant';
import { calendarEnabled } from '@/server/providers/google-calendar';
import { getPreferences } from '@/features/preferences/server';
import { disconnectCalendar, syncCalendarNow } from './actions';

/** Settings row for Google Calendar (F8). Hidden entirely while the feature flag is off. */
export async function CalendarSettings({ ctx, status }: { ctx: Ctx; status?: string }) {
  if (!calendarEnabled()) return null;
  const t = await getTranslations('calendarSync');
  const prefs = await getPreferences();
  const link = await withTenant({ userId: ctx.userId }, (tx) =>
    tx.calendarLink.findUnique({ where: { userId: ctx.userId }, select: { lastSyncedAt: true } }),
  );
  return (
    <section aria-labelledby="settings-calendar" className="flex flex-col gap-1.5">
      <h2 id="settings-calendar" className="px-1 text-[13px] font-semibold text-muted">
        {t('title')}
      </h2>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        {status === 'connected' && (
          <p role="status" className="rounded-[12px] bg-ok-bg px-3.5 py-2.5 text-[14px] text-ok">
            {t('connected')}
          </p>
        )}
        {status === 'failed' && (
          <p role="alert" className="rounded-[12px] bg-lock-bg px-3.5 py-2.5 text-[14px] text-lock-text">
            {t('failed')}
          </p>
        )}
        <p className="text-[14px] text-muted">{t('what')}</p>
        {link ? (
          <>
            <p className="text-[14px]">
              {link.lastSyncedAt
                ? t('lastSync', {
                    time: formatDate(link.lastSyncedAt, prefs, {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    }),
                  })
                : t('notYet')}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <form action={syncCalendarNow}>
                <button className="h-12 w-full rounded-control bg-accent text-[15px] font-semibold text-on-accent">
                  {t('syncNow')}
                </button>
              </form>
              <form action={disconnectCalendar}>
                <button className="h-12 w-full rounded-control border border-border text-[15px]">
                  {t('disconnect')}
                </button>
              </form>
            </div>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- a redirect to Google, not a page
          <a
            href="/api/google/connect"
            className="flex h-12 items-center justify-center rounded-control bg-accent text-[15px] font-semibold text-on-accent"
          >
            {t('connect')}
          </a>
        )}
      </div>
    </section>
  );
}
