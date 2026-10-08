import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/ids';
import { getCtx } from '@/server/context';
import { pdfResponse } from '@/server/pdf-response';
import { receiptData } from '@/features/money/queries';

/** Receipt PDF (F10): permission check here, then the print view rendered by Chromium as the same user. */
export async function GET(request: Request, { params }: RouteContext<'/receipts/[id]/pdf'>) {
  const ctx = await getCtx();
  const { id } = await params;
  if (!ctx || !isUuid(id)) return new NextResponse('Not found', { status: 404 });
  const r = await receiptData(ctx, id);
  if (!r) return new NextResponse('Not found', { status: 404 });
  return pdfResponse(request, `/print/receipts/${id}`, `receipt-${String(r.receiptNo).padStart(4, '0')}.pdf`);
}
