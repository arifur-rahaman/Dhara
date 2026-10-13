import 'server-only';
import { getTranslations } from 'next-intl/server';
import { dbDate, type Ymd } from '@/lib/dates';
import { formatDate, formatNumber, formatTaka } from '@/i18n/format';
import { getPreferences } from '@/features/preferences/server';
import type { CaseType } from '@/features/cases/queries';
import type { invoiceData, receiptData } from './queries';

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

/** A case invoice (F32): fees charged, payments received and the balance, on the same light paper. */
export async function InvoicePaper({ inv }: { inv: NonNullable<Awaited<ReturnType<typeof invoiceData>>> }) {
  const t = await getTranslations('invoice');
  const f = await moneyFormat();
  const fees = [...inv.fees].reverse();
  const payments = [...inv.payments].reverse();
  const due = inv.duePoisha;
  return (
    <article
      aria-label={t('title')}
      className="paper flex flex-col gap-4 rounded-[6px] border border-border px-[22px] py-6 shadow-[0_6px_20px_rgba(0,0,0,0.10)] print:shadow-none"
    >
      <div className="flex flex-col gap-1">
        <span className="font-title text-[22px] leading-snug">{inv.chamber.name}</span>
        {inv.chamber.address && <span className="text-[13px] text-muted">{inv.chamber.address}</span>}
      </div>
      <div className="flex justify-between border-b border-dashed border-[var(--paper-rule)] pb-3 text-[13px] text-muted">
        <span className="font-semibold text-text">{t('title')}</span>
        <span>{f.date(inv.today)}</span>
      </div>
      <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[14px]">
        <dt className="text-muted">{t('client')}</dt>
        <dd className="font-semibold">{inv.clientName ?? '—'}</dd>
        <dt className="text-muted">{t('case')}</dt>
        <dd>{f.caseTitle(inv.case)}</dd>
      </dl>

      <table className="w-full text-[14px]">
        <caption className="pb-1 text-left text-[13px] font-semibold">{t('fees')}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t('date')}</th>
            <th scope="col">{t('for')}</th>
            <th scope="col">{t('amount')}</th>
          </tr>
        </thead>
        <tbody>
          {fees.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-1 text-muted">
                {t('noFees')}
              </td>
            </tr>
          ) : (
            fees.map((fee) => (
              <tr key={fee.id} className="border-t border-[var(--paper-rule)] first:border-t-0">
                <td className="py-1.5 pr-2 whitespace-nowrap text-muted">{f.day(fee.chargedOn)}</td>
                <td className="w-full py-1.5 pr-2">{fee.description}</td>
                <td className="py-1.5 text-right whitespace-nowrap">{f.taka(fee.amountPoisha)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-dashed border-[var(--paper-rule)] font-semibold">
            <th scope="row" colSpan={2} className="pt-2 text-left">
              {t('totalCharged')}
            </th>
            <td className="pt-2 text-right whitespace-nowrap">{f.taka(inv.chargedPoisha)}</td>
          </tr>
        </tfoot>
      </table>

      {payments.length > 0 && (
        <table className="w-full text-[14px]">
          <caption className="pb-1 text-left text-[13px] font-semibold">{t('payments')}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">{t('date')}</th>
              <th scope="col">{t('receipt')}</th>
              <th scope="col">{t('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-[var(--paper-rule)] first:border-t-0">
                <td className="py-1.5 pr-2 whitespace-nowrap text-muted">{f.day(p.paidOn)}</td>
                <td className="w-full py-1.5 pr-2">
                  {t('receiptNo', { no: f.receiptNo(p.receiptNo) })} · {f.method(p.method, p.reference)}
                </td>
                <td className="py-1.5 text-right whitespace-nowrap">{f.taka(p.amountPoisha)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-dashed border-[var(--paper-rule)] font-semibold">
              <th scope="row" colSpan={2} className="pt-2 text-left">
                {t('totalPaid')}
              </th>
              <td className="pt-2 text-right whitespace-nowrap">{f.taka(inv.paidPoisha)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      <div className="flex items-baseline justify-between border-t border-dashed border-[var(--paper-rule)] pt-3">
        <span className="text-[14px] text-muted">{due < 0 ? t('advance') : t('balance')}</span>
        <span className="text-[26px] font-bold">{f.taka(Math.abs(due))}</span>
      </div>
      <span className="text-[12px] text-muted">{t('footer')}</span>
    </article>
  );
}
