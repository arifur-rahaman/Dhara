import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/ids';
import { getCtx } from '@/server/context';
import { pdfResponse } from '@/server/pdf-response';
import { invoiceData } from '@/features/money/queries';

/** Invoice PDF (F32): permission check here, then the print view rendered as the same user. */
export async function GET(request: Request, { params }: RouteContext<'/cases/[id]/invoice/pdf'>) {
  const ctx = await getCtx();
  const { id } = await params;
  if (!ctx || !isUuid(id)) return new NextResponse('Not found', { status: 404 });
  const inv = await invoiceData(ctx, id);
  if (!inv) return new NextResponse('Not found', { status: 404 });
  return pdfResponse(request, `/print/invoices/${id}`, `invoice-${inv.today}.pdf`);
}
