import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/ids';
import { SESSION_COOKIE } from '@/server/auth/session';
import { getCtx } from '@/server/context';
import { env } from '@/server/env';
import { renderPdf } from '@/server/pdf';
import { receiptData } from '@/features/money/queries';

/** Receipt PDF (F10): permission check here, then the print view rendered by Chromium as the same user. */
export async function GET(request: Request, { params }: RouteContext<'/receipts/[id]/pdf'>) {
  const ctx = await getCtx();
  const { id } = await params;
  if (!ctx || !isUuid(id)) return new NextResponse('Not found', { status: 404 });
  const r = await receiptData(ctx, id);
  const session = (await cookies()).get(SESSION_COOKIE);
  if (!r || !session) return new NextResponse('Not found', { status: 404 });

  const origin = env().PDF_RENDER_ORIGIN || new URL(request.url).origin;
  const pdf = await renderPdf(`${origin}/print/receipts/${id}`, { name: SESSION_COOKIE, value: session.value });
  const name = `receipt-${String(r.receiptNo).padStart(4, '0')}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
