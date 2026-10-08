import { Readable } from 'node:stream';
import { open, stat } from 'node:fs/promises';
import { env } from '@/server/env';
import {
  ensureLocalDir,
  localPath,
  localReadStream,
  verifyLocalGrant,
  type LocalGrant,
} from '@/server/providers/storage';
import { MAX_UPLOAD_BYTES } from '@/features/documents/files';

/**
 * Local file storage for development and tests (STORAGE_PROVIDER=local). It answers only to URLs
 * signed by the app, exactly like S3 pre-signed URLs, and never runs in production.
 */
function grant(request: Request, key: string[], op: 'put' | 'get') {
  if (process.env.NODE_ENV === 'production' || env().STORAGE_PROVIDER !== 'local') return null;
  const q = new URL(request.url).searchParams;
  const g: LocalGrant = {
    op,
    key: key.join('/'),
    exp: Number(q.get('exp')),
    ct: q.get('ct') ?? '',
    cd: q.get('cd') ?? '',
  };
  if (q.get('op') !== op || !verifyLocalGrant(g, q.get('sig') ?? '')) return null;
  return g;
}

const forbidden = () => new Response('Forbidden', { status: 403 });

export async function PUT(request: Request, { params }: RouteContext<'/api/files/[...key]'>) {
  const g = grant(request, (await params).key, 'put');
  if (!g || !request.body) return forbidden();
  await ensureLocalDir(g.key);
  const file = await open(localPath(g.key), 'w');
  let written = 0;
  try {
    for await (const chunk of request.body as unknown as AsyncIterable<Uint8Array>) {
      written += chunk.byteLength;
      if (written > MAX_UPLOAD_BYTES) {
        await file.close();
        return new Response('Too large', { status: 413 });
      }
      await file.write(chunk);
    }
  } finally {
    await file.close().catch(() => {});
  }
  return new Response(null, { status: 200 });
}

export async function GET(request: Request, { params }: RouteContext<'/api/files/[...key]'>) {
  const g = grant(request, (await params).key, 'get');
  if (!g) return forbidden();
  try {
    await stat(localPath(g.key));
    const stream = Readable.toWeb(localReadStream(g.key)) as ReadableStream;
    return new Response(stream, {
      headers: {
        'Content-Type': g.ct,
        'Content-Disposition': g.cd,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
