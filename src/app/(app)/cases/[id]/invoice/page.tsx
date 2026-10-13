import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/icons';
import { isUuid } from '@/lib/ids';
import { requireCtx } from '@/server/context';
import { invoiceData } from '@/features/money/queries';
import { InvoicePaper } from '@/features/money/ui';
import { SubpageHeader } from '@/features/shell/subpage-header';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoice');
  return { title: t('title') };
}

/** Case invoice (F32): made from the fee records, no AI. Same light paper as the receipt. */
export default async function InvoicePage({ params }: PageProps<'/cases/[id]/invoice'>) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const inv = await invoiceData(ctx, id);
  if (!inv) notFound();
  const t = await getTranslations('invoice');
  return (
    <div className="flex max-w-[480px] flex-col gap-3 pb-6">
      <SubpageHeader title={t('title')} backHref={`/cases/${id}?tab=fees`} />
      <InvoicePaper inv={inv} />
      <p className="text-[13px] leading-relaxed text-muted">{t('note')}</p>
      <div className="flex flex-col gap-2.5 border-t border-border pt-3">
        <a
          href={`/cases/${id}/invoice/pdf`}
          className="flex h-[50px] items-center justify-center gap-2 rounded-control bg-accent text-[16px] font-semibold text-on-accent"
        >
          <Icon name="documents" size={20} />
          {t('pdf')}
        </a>
      </div>
    </div>
  );
}
