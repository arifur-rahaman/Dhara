import { notFound } from 'next/navigation';
import { isUuid } from '@/lib/ids';
import { requireCtx } from '@/server/context';
import { receiptData } from '@/features/money/queries';
import { ReceiptPaper } from '@/features/money/ui';

/**
 * The bare receipt that the PDF renderer loads (TECH_GUIDE section 14): same component as the screen,
 * no app chrome, light theme, A5-sized page.
 */
export default async function PrintReceipt({ params }: PageProps<'/print/receipts/[id]'>) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const r = await receiptData(ctx, id);
  if (!r) notFound();
  return (
    <main data-print-ready className="paper mx-auto max-w-[520px] p-6">
      <style>{'@page { size: A5; margin: 12mm; } html, body { background: #ffffff !important; }'}</style>
      <ReceiptPaper r={r} />
    </main>
  );
}
