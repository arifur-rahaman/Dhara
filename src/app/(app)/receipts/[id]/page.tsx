import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { isUuid } from '@/lib/ids';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { ReceiptWhatsAppButton } from '@/features/money/forms';
import { receiptData } from '@/features/money/queries';
import { ReceiptPaper } from '@/features/money/ui';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('receipt');
  return { title: t('title') };
}

/** Receipt (docs/design/ReceiptView.dc.html, F10). The paper stays light in dark mode. */
export default async function ReceiptPage({ params, searchParams }: PageProps<'/receipts/[id]'>) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const r = await receiptData(ctx, id);
  if (!r) notFound();
  const t = await getTranslations('receipt');
  const isNew = (await searchParams).new === '1';
  return (
    <div className="flex max-w-[480px] flex-col gap-3 pb-6">
      <SubpageHeader title={t('title')} backHref="/accounts" />
      {isNew && (
        <p role="status" className="rounded-[12px] bg-ok-bg px-4 py-3 text-[15px] text-ok">
          {t('saved')}
        </p>
      )}
      <ReceiptPaper r={r} />
      <p className="text-[13px] leading-relaxed text-muted">{t('lightNote')}</p>
      <div className="flex flex-col gap-2.5 border-t border-border pt-3">
        <a
          href={`/receipts/${r.id}/pdf`}
          className="flex h-[50px] items-center justify-center gap-2 rounded-control bg-accent text-[16px] font-semibold text-on-accent"
        >
          <Icon name="documents" size={20} />
          {t('pdf')}
        </a>
        {can.remindClient(ctx) && r.client && <ReceiptWhatsAppButton paymentId={r.id} />}
      </div>
    </div>
  );
}
