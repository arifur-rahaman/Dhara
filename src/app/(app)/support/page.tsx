import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { formatDate } from '@/i18n/format';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { getPreferences } from '@/features/preferences/server';
import { SubpageHeader } from '@/features/shell/subpage-header';
import { approveSupport, rejectSupport, revokeSupport } from '@/features/support/actions';
import { supportRequests, type SupportRequest } from '@/features/support/queries';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('support');
  return { title: t('title') };
}

/** Support access (docs/design/SupportApproval.dc.html): owner approves for 24 hours, rejects or ends it early (P13). */
export default async function SupportPage() {
  const ctx = await requireCtx();
  if (!can.approveSupportAccess(ctx)) notFound();
  const t = await getTranslations('support');
  const prefs = await getPreferences();
  const when = (d: Date) => formatDate(d, prefs, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  const list = await supportRequests(ctx);
  const pending = list.filter((g) => g.state === 'pending');
  const active = list.filter((g) => g.state === 'active');
  const ended = list.filter((g) => g.state === 'ended');

  const Hidden = ({ g }: { g: SupportRequest }) => <input type="hidden" name="grantId" value={g.id} />;

  return (
    <div className="flex max-w-[560px] flex-col gap-5">
      <SubpageHeader title={t('title')} backHref="/today" />

      {list.length === 0 && (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('none')}</p>
      )}

      {pending.map((g) => (
        <section key={g.id} aria-labelledby={`req-${g.id}`} className="flex flex-col gap-3.5">
          <div className="flex flex-col items-start gap-2.5">
            <span className="flex size-[52px] items-center justify-center rounded-[16px] bg-lock-bg text-lock-text">
              <Icon name="shield" size={26} />
            </span>
            <h2 id={`req-${g.id}`} className="font-title text-[24px] leading-[1.4]">
              {t('heading')}
            </h2>
            <span className="text-[14px] text-muted">
              {t('byline', { name: g.adminName, time: when(g.requestedAt) })}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-[14px] border border-border bg-surface px-4 py-3.5">
            <span className="text-[13px] font-semibold text-muted">{t('reason')}</span>
            <span className="text-[15px] leading-relaxed whitespace-pre-line">{g.reason}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-2 rounded-[14px] border border-border bg-surface p-3.5">
              <span className="text-[13px] font-semibold text-ok">{t('canSee')}</span>
              <span className="text-[14px] leading-normal">{t('seeSettings')}</span>
              <span className="text-[14px] leading-normal">{t('seeCases')}</span>
            </div>
            <div className="flex flex-col gap-2 rounded-[14px] bg-lock-bg p-3.5">
              <span className="text-[13px] font-semibold text-lock-text">{t('neverSee')}</span>
              <span className="text-[14px] leading-normal">{t('neverContact')}</span>
              <span className="text-[14px] leading-normal">{t('neverDocs')}</span>
              <span className="text-[14px] leading-normal">{t('neverFees')}</span>
            </div>
          </div>
          <p className="flex items-start gap-2.5 text-[14px] leading-relaxed text-muted">
            <Icon name="clock" size={18} className="mt-[3px] shrink-0" />
            {t('expiryNote')}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <form action={rejectSupport}>
              <Hidden g={g} />
              <button className="h-[50px] w-full rounded-control border border-border text-[16px] font-medium">
                {t('reject')}
              </button>
            </form>
            <form action={approveSupport}>
              <Hidden g={g} />
              <button className="h-[50px] w-full rounded-control bg-accent text-[16px] font-semibold text-on-accent">
                {t('approve')}
              </button>
            </form>
          </div>
        </section>
      ))}

      {active.map((g) => (
        <section
          key={g.id}
          aria-labelledby={`active-${g.id}`}
          className="flex flex-col gap-3 rounded-card border-2 border-accent bg-surface p-4"
        >
          <h2 id={`active-${g.id}`} className="text-[16px] font-semibold">
            {t('activeTitle', { name: g.adminName })}
          </h2>
          <p className="text-[14px] text-muted">{t('activeUntil', { time: when(g.expiresAt!) })}</p>
          <p className="text-[14px]">{g.reason}</p>
          <form action={revokeSupport}>
            <Hidden g={g} />
            <button className="h-12 w-full rounded-control border border-lock-text text-[16px] font-semibold text-lock-text">
              {t('revoke')}
            </button>
          </form>
        </section>
      ))}

      {ended.length > 0 && (
        <section aria-labelledby="support-past" className="flex flex-col gap-2">
          <h2 id="support-past" className="text-[16px] font-semibold">
            {t('past')}
          </h2>
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {ended.map((g) => (
              <li key={g.id} className="flex flex-col gap-0.5 border-t border-border py-3 first:border-t-0">
                <span className="text-[15px]">{g.adminName}</span>
                <span className="text-[13px] text-muted">
                  {when(g.requestedAt)} · {g.approvedAt ? t('wasApproved') : t('wasRejected')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
