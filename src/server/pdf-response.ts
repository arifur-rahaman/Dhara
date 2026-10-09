import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/server/auth/session';
import { env } from '@/server/env';
import { renderPdf } from '@/server/pdf';

/**
 * Renders one of the app's /print pages as the signed-in person and returns it as a PDF download.
 * Callers check permission first; the print page checks again when Chromium loads it.
 */
export async function pdfResponse(request: Request, printPath: string, fileName: string) {
  const session = (await cookies()).get(SESSION_COOKIE);
  if (!session) return new NextResponse('Not found', { status: 404 });
  const origin = env().PDF_RENDER_ORIGIN || new URL(request.url).origin;
  const pdf = await renderPdf(`${origin}${printPath}`, { name: SESSION_COOKIE, value: session.value });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
