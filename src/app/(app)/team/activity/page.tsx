import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { formatDate } from '@/i18n/format';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { getPreferences } from '@/features/preferences/server';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('activity');
  return { title: t('title') };
}

const LIMIT = 200;

/**
 * The chamber's activity log, owner only (plan.md principle 3). Shows who did what and when;
 * never the changed values themselves, so no client contact appears here.
 */
export default async function ActivityPage() {
  const ctx = await requireCtx();
  if (!can.viewAuditLog(ctx)) notFound();
  const t = await getTranslations();
  const prefs = await getPreferences();

  const { entries, names } = await withTenant(scopeOf(ctx), async (tx) => {
    const entries = await tx.auditLog.findMany({
      where: { chamberId: ctx.chamberId },
      orderBy: { at: 'desc' },
      take: LIMIT,
      select: { id: true, at: true, action: true, actorKind: true, actorUserId: true },
    });
    const ids = [...new Set(entries.map((e) => e.actorUserId).filter((id): id is string => !!id))];
    const users = await tx.user.findMany({
      where: { id: { in: ids }, memberships: { some: { chamberId: ctx.chamberId } } },
      select: { id: true, name: true },
    });
    return { entries, names: new Map(users.map((u) => [u.id, u.name])) };
  });

  const actor = (e: (typeof entries)[number]) =>
    e.actorKind === 'admin'
      ? t('activity.platformSupport')
      : e.actorUserId === ctx.userId
        ? t('team.you')
        : (names.get(e.actorUserId ?? '') ?? t('activity.unknown'));
  const action = (a: string) => {
    const key = `activity.actions.${a.replace('.', '_')}`;
    return t.has(key) ? t(key) : a;
  };

  return (
    <div className="flex max-w-[720px] flex-col gap-4">
      <SubpageHeader title={t('activity.title')} backHref="/team" />
      <p className="text-[15px] text-muted">{t('activity.subtitle')}</p>
      {entries.length === 0 ? (
        <p className="rounded-card border border-border bg-surface px-5 py-6 text-[15px] text-muted">
          {t('activity.empty')}
        </p>
      ) : (
        <ol className="flex flex-col rounded-card border border-border bg-surface px-5">
          {entries.map((e, i) => (
            <li key={e.id} className={`flex flex-col gap-0.5 py-3 ${i ? 'border-t border-border' : ''}`}>
              <span className="text-[15px]">
                <span className="font-semibold">{actor(e)}</span> · {action(e.action)}
              </span>
              <time dateTime={e.at.toISOString()} className="text-[13px] text-muted">
                {formatDate(e.at, prefs, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
