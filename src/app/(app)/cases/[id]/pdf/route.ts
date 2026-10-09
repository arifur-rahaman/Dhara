import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/ids';
import { getCtx } from '@/server/context';
import { pdfResponse } from '@/server/pdf-response';
import { getCase } from '@/features/cases/queries';

/** A case's hearing history as PDF (F6). */
export async function GET(request: Request, { params }: RouteContext<'/cases/[id]/pdf'>) {
  const ctx = await getCtx();
  const { id } = await params;
  if (!ctx || !isUuid(id)) return new NextResponse('Not found', { status: 404 });
  const c = await getCase(ctx, id);
  if (!c) return new NextResponse('Not found', { status: 404 });
  return pdfResponse(request, `/print/cases/${id}`, `case-${c.number}-${c.year}-history.pdf`.replace(/[^\w.-]/g, '_'));
}
