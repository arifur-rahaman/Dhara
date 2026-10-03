import 'server-only';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { formatDate, formatNumber, formatTaka } from '@/i18n/format';
import { getPreferences } from '@/features/preferences/server';
import type { SupportSummary } from './queries';

export async function adminFormat() {
  const prefs = await getPreferences();
  return {
    prefs,
    date: (d: Date) => formatDate(d, prefs, { day: 'numeric', month: 'short', year: 'numeric' }),
    dateTime: (d: Date) => formatDate(d, prefs, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
    number: (n: number) => formatNumber(n, prefs),
    taka: (poisha: number) => formatTaka(poisha, prefs),
  };
}

export async function StatusPill({ status }: { status: string }) {
  const t = await getTranslations('admin.status');
  const tone =
    status === 'active'
      ? 'bg-ok-bg text-ok'
      : status === 'trial'
        ? 'bg-accent-soft text-accent'
        : 'bg-lock-bg text-lock-text';
  return (
    <span className={`justify-self-start rounded-full px-2.5 py-[3px] text-[12px] font-semibold ${tone}`}>
      {t.has(status) ? t(status) : status}
    </span>
  );
}

/** "Approved · 23 hours left", "Waiting for the owner", "None" (SuperAdmin design). */
export async function SupportCell({ s }: { s?: SupportSummary }) {
  const t = await getTranslations('admin.support');
  const f = await adminFormat();
  if (s?.state === 'active') {
    return (
      <span className="text-[13px] leading-[1.45] text-ok">{t('approvedLeft', { hours: f.number(s.hoursLeft) })}</span>
    );
  }
  if (s?.state === 'pending') return <span className="text-[13px] leading-[1.45] text-lock-text">{t('waiting')}</span>;
  return <span className="text-[13px] leading-[1.45] text-muted">{t('none')}</span>;
}

export async function HowSupportWorks({ children }: { children?: React.ReactNode }) {
  const t = await getTranslations('admin.support');
  const f = await adminFormat();
  return (
    <section
      aria-labelledby="how-support"
      className="flex flex-col gap-3.5 rounded-card border border-border bg-surface px-5 pt-[18px] pb-5"
    >
      <h2 id="how-support" className="text-[16px] font-semibold">
        {t('howTitle')}
      </h2>
      <ol className="flex flex-col gap-3.5">
        {(['how1', 'how2', 'how3'] as const).map((key, i) => (
          <li key={key} className="flex items-start gap-3">
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">
              {f.number(i + 1)}
            </span>
            <span className="text-[14px] leading-relaxed">{t(key)}</span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2.5 rounded-[12px] bg-lock-bg p-3 text-[13.5px] leading-[1.55]">
        <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-lock-text" />
        {t('contactHidden')}
      </p>
      {children}
    </section>
  );
}

export async function AdminPageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-[15px] text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
