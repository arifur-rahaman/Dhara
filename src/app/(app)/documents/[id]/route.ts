import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/ids';
import { getCtx } from '@/server/context';
import { storage } from '@/server/providers/storage';
import { documentForDownload } from '@/features/documents/queries';

/**
 * Opens a document: permission check on every request (P5, P6, and RLS), then a redirect to a
 * signed storage URL that lasts 5 minutes (TECH_GUIDE section 13). ?download=1 saves instead of viewing.
 */
export async function GET(request: Request, { params }: RouteContext<'/documents/[id]'>) {
  const ctx = await getCtx();
  const { id } = await params;
  if (!ctx || !isUuid(id)) return new NextResponse('Not found', { status: 404 });
  const doc = await documentForDownload(ctx, id);
  if (!doc) return new NextResponse('Not found', { status: 404 });
  const inline = new URL(request.url).searchParams.get('download') !== '1';
  const url = await storage().downloadUrl(doc.storageKey, {
    fileName: doc.fileName,
    contentType: doc.contentType,
    inline,
  });
  return NextResponse.redirect(new URL(url, request.url), { status: 303, headers: { 'Cache-Control': 'no-store' } });
}
