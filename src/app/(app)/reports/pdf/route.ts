import { NextResponse } from 'next/server';
import { audit } from '@/server/audit';
import { can } from '@/server/authz';
import { getCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { pdfResponse } from '@/server/pdf-response';

/** Reports as PDF (F23). Owner only; an export, so it is audited (CLAUDE.md rule 5). */
export async function GET(request: Request) {
  const ctx = await getCtx();
  if (!ctx || !can.viewReports(ctx)) return new NextResponse('Not found', { status: 404 });
  const range = new URL(request.url).searchParams.get('range');
  const safeRange = range === 'month' || range === 'year' ? range : 'half';
  const res = await pdfResponse(request, `/print/reports?range=${safeRange}`, 'dhara-report.pdf');
  await withTenant(scopeOf(ctx), (tx) =>
    audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'export.report_pdf',
      entity: 'report',
      fields: { range: safeRange },
    }),
  );
  return res;
}
