import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { RemindButton } from '@/features/money/forms';
import { accountsOverview } from '@/features/money/queries';
import { moneyFormat } from '@/features/money/ui';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('accounts') };
}

/** Accounts (docs/design/Accounts.dc.html, F9, F12): this month's collection, dues and recent payments (P9). */
export default async function AccountsPage() {
  const ctx = await requireCtx();
  if (!can.viewFees(ctx)) notFound();
  const t = await getTranslations();
  const f = await moneyFormat();
  const a = (await accountsOverview(ctx))!;
  const owner = can.recordMoney(ctx);

  return (
    <div className="flex max-w-[640px] flex-col gap-3.5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="page-title">{t('nav.accounts')}</h1>
        {owner && (
          <Link
            href="/accounts/pay"
            className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[15px] font-semibold text-on-accent"
          >
            <span aria-hidden="true" className="text-[20px] leading-none">
              +
            </span>
            {t('money.payment')}
          </Link>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1 rounded-[14px] border border-border bg-surface p-3.5">
          <span className="text-[13px] text-muted">{t('money.monthCollection', { month: f.month(a.monthStart) })}</span>
          <span className="text-[22px] font-bold">{f.taka(a.monthPoisha)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[14px] bg-lock-bg p-3.5">
          <span className="text-[13px] text-muted">{t('money.totalDue')}</span>
          <span className="text-[22px] font-bold text-lock-text">{f.taka(a.duePoisha)}</span>
        </div>
      </div>

      <section aria-labelledby="dues" className="flex flex-col gap-2">
        <h2 id="dues" className="text-[16px] font-semibold">
          {t('money.dues')}
        </h2>
        {a.dues.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('money.noDues')}</p>
        ) : (
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {a.dues.map((d) => (
              <li
                key={d.case.id}
                className="flex min-h-[72px] items-center justify-between gap-3 border-t border-border py-2 first:border-t-0"
              >
                <Link href={`/cases/${d.case.id}?tab=fees`} className="flex min-w-0 flex-col gap-px">
                  <span className="truncate text-[15px] font-semibold">{d.clientName ?? f.caseTitle(d.case)}</span>
                  <span className="text-[13px] text-muted">{f.caseTitle(d.case)}</span>
                </Link>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="text-[15px] font-bold">{f.taka(d.duePoisha)}</span>
                  {owner && d.clientId && (
                    <RemindButton
                      caseId={d.case.id}
                      label={t('money.remindLabel', { name: d.clientName ?? f.caseTitle(d.case) })}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent" className="flex flex-col gap-2">
        <h2 id="recent" className="text-[16px] font-semibold">
          {t('money.recent')}
        </h2>
        {a.recent.length === 0 ? (
          <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">
            {t('money.noPayments')}
          </p>
        ) : (
          <ul className="flex flex-col rounded-card border border-border bg-surface px-4">
            {a.recent.map((p) => (
              <li
                key={p.id}
                className="flex min-h-16 items-center justify-between gap-3 border-t border-border py-2 first:border-t-0"
              >
                <div className="flex min-w-0 flex-col gap-px">
                  <span className="truncate text-[15px] font-semibold">{p.clientName ?? f.caseTitle(p.case)}</span>
                  <span className="text-[13px] text-muted">
                    {t(`money.methods.${p.method}`)} · {f.day(p.paidOn)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="text-[15px] font-bold text-ok">{f.taka(p.amountPoisha)}</span>
                  <Link
                    href={`/receipts/${p.id}`}
                    aria-label={t('money.receiptLabel', { name: p.clientName ?? f.caseTitle(p.case) })}
                    className="flex size-11 items-center justify-center rounded-full border border-border"
                  >
                    <Icon name="documents" size={20} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
