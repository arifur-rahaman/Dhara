import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { can } from '@/server/authz';
import { SESSION_COOKIE } from '@/server/auth/session';
import { getCtx } from '@/server/context';
import { env } from '@/server/env';
import { renderPdf } from '@/server/pdf';
import { audit } from '@/server/audit';
import { scopeOf, withTenant } from '@/server/db/tenant';

/** Reports as PDF (F23). Owner only; an export, so it is audited (CLAUDE.md rule 5). */
export async function GET(request: Request) {
  const ctx = await getCtx();
  const session = (await cookies()).get(SESSION_COOKIE);
  if (!ctx || !session || !can.viewReports(ctx)) return new NextResponse('Not found', { status: 404 });
  const range = new URL(request.url).searchParams.get('range');
  const safeRange = range === 'month' || range === 'year' ? range : 'half';
  const origin = env().PDF_RENDER_ORIGIN || new URL(request.url).origin;
  const pdf = await renderPdf(`${origin}/print/reports?range=${safeRange}`, {
    name: SESSION_COOKIE,
    value: session.value,
  });
  await withTenant(scopeOf(ctx), (tx) =>
    audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'export.report_pdf',
      entity: 'report',
      fields: { range: safeRange },
    }),
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="dhara-report.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
