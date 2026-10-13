import { notFound } from 'next/navigation';
import { isUuid } from '@/lib/ids';
import { requireCtx } from '@/server/context';
import { invoiceData } from '@/features/money/queries';
import { InvoicePaper } from '@/features/money/ui';

/** The bare invoice the PDF renderer loads: no app chrome, light theme, A4 page. */
export default async function PrintInvoice({ params }: PageProps<'/print/invoices/[id]'>) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const inv = await invoiceData(ctx, id);
  if (!inv) notFound();
  return (
    <main data-print-ready className="paper mx-auto max-w-[640px] p-6">
      <style>{'@page { size: A4; margin: 15mm; } html, body { background: #ffffff !important; }'}</style>
      <InvoicePaper inv={inv} />
    </main>
  );
}
