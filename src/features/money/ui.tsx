import 'server-only';
import { getTranslations } from 'next-intl/server';
import { dbDate, type Ymd } from '@/lib/dates';
import { formatDate, formatNumber, formatTaka } from '@/i18n/format';
import { getPreferences } from '@/features/preferences/server';
import type { CaseType } from '@/features/cases/queries';
import type { receiptData } from './queries';

export async function moneyFormat() {
  const prefs = await getPreferences();
  const t = await getTranslations();
  return {
    prefs,
    taka: (poisha: number) => formatTaka(poisha, prefs),
    day: (ymd: Ymd) => formatDate(dbDate(ymd), prefs, { day: 'numeric', month: 'long' }),
    date: (ymd: Ymd) => formatDate(dbDate(ymd), prefs, { day: 'numeric', month: 'long', year: 'numeric' }),
    month: (ymd: Ymd) => formatDate(dbDate(ymd), prefs, { month: 'long' }),
    receiptNo: (n: number) => formatNumber(n, prefs, { minimumIntegerDigits: 4, useGrouping: false }),
    caseTitle: (c: { type: CaseType | string; number: string; year: string }) =>
      `${t(`caseType.${c.type as CaseType}`)} ${c.number}/${c.year}`,
    method: (m: string, reference?: string | null) =>
      `${t(`money.methods.${m}`)}${reference ? ` · ${t('money.referenceShort', { ref: reference })}` : ''}`,
  };
}

/** The receipt itself (ReceiptView design). Always light: the .paper scope fixes the colours. */
export async function ReceiptPaper({ r }: { r: NonNullable<Awaited<ReturnType<typeof receiptData>>> }) {
  const t = await getTranslations();
  const f = await moneyFormat();
  const rows: [string, string][] = [
    [t('receipt.client'), r.client?.displayName ?? '—'],
    [t('receipt.case'), f.caseTitle(r.case)],
    [t('receipt.for'), r.description],
    [t('receipt.method'), f.method(r.method, r.reference)],
    [
      t('receipt.receivedBy'),
      r.receivedBy ? (r.receivedBy.role === 'owner' ? t('roles.owner') : (r.receivedBy.name ?? '')) : '—',
    ],
  ];
  return (
    <article
      aria-label={t('receipt.title')}
      className="paper flex flex-col gap-4 rounded-[6px] border border-border px-[22px] py-6 shadow-[0_6px_20px_rgba(0,0,0,0.10)] print:shadow-none"
    >
      <div className="flex flex-col gap-1">
        <span className="font-title text-[22px] leading-snug">{r.chamber.name}</span>
        {r.chamber.address && <span className="text-[13px] text-muted">{r.chamber.address}</span>}
      </div>
      <div className="flex justify-between border-b border-dashed border-[var(--paper-rule)] pb-3 text-[13px] text-muted">
        <span>{t('receipt.number', { no: f.receiptNo(r.receiptNo) })}</span>
        <span>{f.date(r.paidOn)}</span>
      </div>
      <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[14px]">
        {rows.map(([k, v], i) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className={i === 0 ? 'font-semibold' : ''}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-baseline justify-between border-t border-dashed border-[var(--paper-rule)] pt-3">
        <span className="text-[14px] text-muted">{t('receipt.amount')}</span>
        <span className="text-[26px] font-bold">{f.taka(r.amountPoisha)}</span>
      </div>
      <span className="text-[12px] text-muted">{t('receipt.footer')}</span>
    </article>
  );
}
