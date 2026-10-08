import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { todayInDhaka } from '@/lib/dates';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { PaymentForm } from '@/features/money/forms';
import { paymentCaseOptions } from '@/features/money/queries';
import { moneyFormat } from '@/features/money/ui';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('money');
  return { title: t('recordTitle') };
}

/** Record money received (F9, F11). Not in the designs; follows the app's form layout. */
export default async function PayPage({ searchParams }: PageProps<'/accounts/pay'>) {
  const ctx = await requireCtx();
  if (!can.recordMoney(ctx)) notFound();
  const t = await getTranslations();
  const f = await moneyFormat();
  const options = await paymentCaseOptions(ctx);
  const sp = await searchParams;
  const caseId = typeof sp.case === 'string' ? sp.case : undefined;
  return (
    <div className="flex max-w-[480px] flex-col gap-4">
      <SubpageHeader title={t('money.recordTitle')} backHref="/accounts" />
      {options.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-4 text-[15px] text-muted">{t('money.noCases')}</p>
      ) : (
        <PaymentForm
          today={todayInDhaka()}
          defaultCaseId={options.some((o) => o.id === caseId) ? caseId : undefined}
          cases={options.map((o) => ({
            id: o.id,
            label: `${f.caseTitle(o)}${o.clientName ? ` · ${o.clientName}` : ''}${o.duePoisha > 0 ? ` · ${t('money.dueShort', { amount: f.taka(o.duePoisha) })}` : ''}`,
          }))}
        />
      )}
    </div>
  );
}
