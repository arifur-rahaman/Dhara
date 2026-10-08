import { NextResponse } from 'next/server';
import { isYmd, todayInDhaka } from '@/lib/dates';
import { can } from '@/server/authz';
import { getCtx } from '@/server/context';
import { pdfResponse } from '@/server/pdf-response';

/** Printable daily list as PDF (F6). ?date=YYYY-MM-DD, default today in Asia/Dhaka. */
export async function GET(request: Request) {
  const ctx = await getCtx();
  if (!ctx || !can.listCases(ctx)) return new NextResponse('Not found', { status: 404 });
  const q = new URL(request.url).searchParams.get('date');
  const date = q && isYmd(q) ? q : todayInDhaka();
  return pdfResponse(request, `/print/day?date=${date}`, `daily-list-${date}.pdf`);
}
