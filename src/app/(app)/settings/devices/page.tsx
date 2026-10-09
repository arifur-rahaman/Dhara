import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { signOutDevices } from '@/features/account/actions';
import { getPreferences } from '@/features/preferences/server';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { formatDate } from '@/i18n/format';
import { deviceLabel } from '@/lib/user-agent';
import { activeSessions, getSession } from '@/server/auth/session';
import { requireCtx } from '@/server/context';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('devices');
  return { title: t('title') };
}

/** Settings → Login devices: where this person is signed in, with remote log out (TECH_GUIDE section 5). */
export default async function DevicesPage() {
  const ctx = await requireCtx();
  const current = (await getSession())!;
  const sessions = await activeSessions(ctx.userId);
  const prefs = await getPreferences();
  const t = await getTranslations('devices');
  const when = (d: Date) => formatDate(d, prefs, { dateStyle: 'medium', timeStyle: 'short' });
  const others = sessions.filter((s) => s.id !== current.id);

  return (
    <div className="flex max-w-[560px] flex-col gap-3.5">
      <SubpageHeader title={t('title')} backHref="/settings" />
      <p className="text-[14px] leading-relaxed text-muted">{t('intro')}</p>
      <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
        {sessions.map((s, i) => {
          const isCurrent = s.id === current.id;
          return (
            <li
              key={s.id}
              className={`flex min-h-[64px] items-center justify-between gap-3 py-2.5 ${i ? 'border-t border-border' : ''}`}
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-[15px] font-semibold">{deviceLabel(s.userAgent) ?? t('unknown')}</span>
                <span className="text-[13px] text-muted">
                  {isCurrent ? t('thisDevice') : t('lastActive', { when: when(s.lastSeenAt) })}
                </span>
              </div>
              {!isCurrent && (
                <form action={signOutDevices}>
                  <input type="hidden" name="session" value={s.id} />
                  <button
                    type="submit"
                    className="min-h-11 shrink-0 rounded-control border border-border px-3 text-[14px] font-semibold text-lock-text"
                  >
                    {t('signOut')}
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {others.length > 0 && (
        <form action={signOutDevices}>
          <input type="hidden" name="session" value="others" />
          <button
            type="submit"
            className="flex min-h-[52px] w-full items-center justify-center rounded-control border border-border bg-surface text-[15px] font-semibold text-lock-text"
          >
            {t('signOutOthers')}
          </button>
        </form>
      )}
    </div>
  );
}
