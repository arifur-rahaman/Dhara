import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Icon, type IconName } from '@/components/icons';
import { dbDate, todayInDhaka } from '@/lib/dates';
import { formatDate } from '@/i18n/format';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import type { CaseType } from '@/features/cases/queries';
import { markAllNotificationsRead } from '@/features/notifications/actions';
import { listNotifications, yesterdayInDhaka, type NoticeRow } from '@/features/notifications/queries';
import { getPreferences } from '@/features/preferences/server';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('notifications') };
}

const look: Record<string, { icon: IconName; tone: string }> = {
  'support.request': { icon: 'shield', tone: 'bg-lock-bg text-lock-text' },
  'hearing.added': { icon: 'clients', tone: 'bg-surface-2 text-text' },
  'task.assigned': { icon: 'tasks', tone: 'bg-surface-2 text-text' },
  'reminder.night': { icon: 'calendar', tone: 'bg-accent-soft text-accent' },
  'reminder.morning': { icon: 'calendar', tone: 'bg-accent-soft text-accent' },
};

/** Notification centre (docs/design/Notifications.dc.html): today, yesterday, earlier; unread dot. */
export default async function NotificationsPage() {
  const ctx = await requireCtx();
  const t = await getTranslations();
  const prefs = await getPreferences();
  const items = await listNotifications(ctx);
  const byIds = [...new Set(items.map((n) => n.payload.by).filter((v): v is string => typeof v === 'string'))];
  const names = new Map(
    (
      await withTenant(scopeOf(ctx), (tx) =>
        tx.membership.findMany({
          where: { chamberId: ctx.chamberId, userId: { in: byIds } },
          select: { userId: true, user: { select: { name: true } } },
        }),
      )
    ).map((m) => [m.userId, m.user.name ?? '']),
  );
  const time = (d: Date) => formatDate(d, prefs, { hour: 'numeric', minute: '2-digit' });
  const caseTitle = (p: Record<string, unknown>) =>
    `${t(`caseType.${p.type as CaseType}`)} ${String(p.number)}/${String(p.year)}`;

  const render = (n: NoticeRow): { text: string; href: string } => {
    const p = n.payload;
    switch (n.kind) {
      case 'support.request':
        return { text: t('notifications.supportRequest'), href: '/support' };
      case 'hearing.added':
        return {
          text: t('notifications.hearingAdded', { name: names.get(String(p.by)) ?? '', case: caseTitle(p) }),
          href: `/cases/${String(p.caseId)}`,
        };
      case 'task.assigned':
        return { text: t('notifications.taskAssigned', { name: names.get(String(p.by)) ?? '' }), href: '/tasks' };
      case 'reminder.night':
        return { text: t('notifications.night', { hearings: Number(p.hearings) }), href: '/calendar' };
      default:
        return {
          text:
            Number(p.tasks) > 0
              ? t('notifications.morningWithTasks', { hearings: Number(p.hearings), tasks: Number(p.tasks) })
              : t('notifications.morning', { hearings: Number(p.hearings) }),
          href: '/today',
        };
    }
  };

  const today = todayInDhaka();
  const yesterday = yesterdayInDhaka();
  const groups = [
    [t('notifications.today'), items.filter((n) => n.day === today)],
    [t('notifications.yesterday'), items.filter((n) => n.day === yesterday)],
    [t('notifications.earlier'), items.filter((n) => n.day < yesterday)],
  ] as const;

  return (
    <div className="flex max-w-[560px] flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <SubpageHeader title={t('nav.notifications')} />
        {items.some((n) => !n.read) && (
          <form action={markAllNotificationsRead} className="-mt-4 md:mt-0">
            <button className="flex h-11 items-center px-2.5 text-[14px] font-semibold text-accent">
              {t('notifications.markAll')}
            </button>
          </form>
        )}
      </div>
      {items.length === 0 && (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">
          {t('notifications.none')}
        </p>
      )}
      {groups.map(
        ([label, list]) =>
          list.length > 0 && (
            <section key={label} aria-label={label} className="flex flex-col gap-2.5">
              <h2 className="mt-1.5 text-[14px] font-semibold text-muted">{label}</h2>
              <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
                {list.map((n) => {
                  const { text, href } = render(n);
                  const l = look[n.kind] ?? look['reminder.morning'];
                  return (
                    <li key={n.id} className="border-t border-border first:border-t-0">
                      <Link href={href} className="flex items-start gap-3 py-3.5">
                        <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${l.tone}`}>
                          <Icon name={l.icon} size={18} />
                        </span>
                        <span className="flex min-w-0 grow flex-col gap-[3px]">
                          <span className={`text-[15px] leading-normal ${n.read ? '' : 'font-semibold'}`}>{text}</span>
                          <span className="text-[12px] text-muted">
                            {n.day === today || n.day === yesterday
                              ? time(n.createdAt)
                              : formatDate(dbDate(n.day), prefs, { day: 'numeric', month: 'long' })}
                          </span>
                        </span>
                        <span
                          aria-label={n.read ? undefined : t('notifications.unread')}
                          className={`mt-2 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-accent'}`}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
