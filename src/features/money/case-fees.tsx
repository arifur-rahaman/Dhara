import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { todayInDhaka } from '@/lib/dates';
import { can, type Ctx } from '@/server/authz';
import { removeFee } from './actions';
import { FeeForm } from './forms';
import { caseMoney } from './queries';
import { moneyFormat } from './ui';

/** Fee tab on a case (CaseDetail design, F9): charged, received, due; fees and receipts. */
export async function CaseFees({ ctx, caseId }: { ctx: Ctx; caseId: string }) {
  const m = await caseMoney(ctx, caseId);
  if (!m) return null;
  const t = await getTranslations('money');
  const f = await moneyFormat();
  const owner = can.recordMoney(ctx);
  return (
    <section aria-label={t('feesTab')} className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-2">
        {[
          [t('charged'), m.chargedPoisha, ''],
          [t('received'), m.paidPoisha, 'text-ok'],
          [t('due'), Math.max(0, m.duePoisha), m.duePoisha > 0 ? 'text-lock-text' : ''],
        ].map(([label, value, tone]) => (
          <div
            key={label as string}
            className="flex flex-col gap-0.5 rounded-[14px] border border-border bg-surface p-3"
          >
            <dt className="text-[12px] text-muted">{label}</dt>
            <dd className={`text-[17px] font-bold ${tone}`}>{f.taka(value as number)}</dd>
          </div>
        ))}
      </dl>

      <h3 className="text-[15px] font-semibold">{t('feesTitle')}</h3>
      {m.fees.length === 0 ? (
        <p className="text-[14px] text-muted">{t('noFees')}</p>
      ) : (
        <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
          {m.fees.map((fee) => (
            <li
              key={fee.id}
              className="flex min-h-14 items-center justify-between gap-3 border-t border-border py-2 first:border-t-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-[15px]">{fee.description}</span>
                <span className="text-[13px] text-muted">{f.day(fee.chargedOn)}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[15px] font-semibold">{f.taka(fee.amountPoisha)}</span>
                {owner && (
                  <form action={removeFee}>
                    <input type="hidden" name="feeId" value={fee.id} />
                    <button
                      aria-label={t('removeFee', { name: fee.description })}
                      className="flex size-11 items-center justify-center text-[20px] text-muted"
                    >
                      ×
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {owner && <FeeForm caseId={caseId} today={todayInDhaka()} />}

      <h3 className="text-[15px] font-semibold">{t('receiptsTitle')}</h3>
      {m.payments.length === 0 ? (
        <p className="text-[14px] text-muted">{t('noPayments')}</p>
      ) : (
        <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
          {m.payments.map((p) => (
            <li key={p.id} className="border-t border-border first:border-t-0">
              <Link href={`/receipts/${p.id}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[15px]">{p.description}</span>
                  <span className="text-[13px] text-muted">
                    {t('receiptShort', { no: f.receiptNo(p.receiptNo) })} · {f.method(p.method, p.reference)} ·{' '}
                    {f.day(p.paidOn)}
                  </span>
                </div>
                <span className="shrink-0 text-[15px] font-semibold text-ok">{f.taka(p.amountPoisha)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {owner && (
        <Link
          href={`/accounts/pay?case=${caseId}`}
          className="flex h-[50px] items-center justify-center rounded-control bg-accent text-[16px] font-semibold text-on-accent"
        >
          {t('recordTitle')}
        </Link>
      )}
    </section>
  );
}
