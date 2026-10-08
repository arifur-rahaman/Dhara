import 'server-only';
import { createReadStream } from 'node:fs';
import { mkdir, open, rm, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { AwsClient } from 'aws4fetch';
import { keyedHash, safeEqual } from '@/server/crypto';
import { env } from '@/server/env';

/**
 * Object storage (TECH_GUIDE section 13). Browsers upload and download directly with short-lived
 * signed URLs; the app issues them only after its own permission checks.
 */
export const SIGNED_URL_SECONDS = 300;

export interface StorageProvider {
  /** URL the browser PUTs the file body to. */
  uploadUrl(key: string, contentType: string): Promise<string>;
  /** URL that downloads the file under its original name. */
  downloadUrl(key: string, opts: { fileName: string; contentType: string; inline?: boolean }): Promise<string>;
  /** Size of a stored object, or null when it does not exist. */
  size(key: string): Promise<number | null>;
  /** The first bytes of an object, to check what the file really is. */
  head(key: string, bytes: number): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

function disposition(fileName: string, inline?: boolean) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// ---------------------------------------------------------------------------
// S3-compatible storage (MinIO, AWS S3, Cloudflare R2), path-style URLs.
// ---------------------------------------------------------------------------
function s3Provider(): StorageProvider {
  const e = env();
  if (!e.S3_ENDPOINT || !e.S3_BUCKET || !e.S3_ACCESS_KEY || !e.S3_SECRET_KEY) {
    throw new Error('S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY must be set. See .env.example.');
  }
  const client = new AwsClient({
    accessKeyId: e.S3_ACCESS_KEY,
    secretAccessKey: e.S3_SECRET_KEY,
    service: 's3',
    region: e.S3_REGION ?? 'us-east-1',
  });
  const objectUrl = (key: string) =>
    new URL(`${e.S3_ENDPOINT!.replace(/\/$/, '')}/${e.S3_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`);
  const presign = async (url: URL, method: string) => {
    url.searchParams.set('X-Amz-Expires', String(SIGNED_URL_SECONDS));
    const signed = await client.sign(new Request(url, { method }), { aws: { signQuery: true } });
    return signed.url;
  };
  return {
    uploadUrl: (key) => presign(objectUrl(key), 'PUT'),
    downloadUrl: (key, { fileName, contentType, inline }) => {
      const url = objectUrl(key);
      url.searchParams.set('response-content-disposition', disposition(fileName, inline));
      url.searchParams.set('response-content-type', contentType);
      return presign(url, 'GET');
    },
    async size(key) {
      const res = await client.fetch(objectUrl(key), { method: 'HEAD' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Storage HEAD failed: ${res.status}`);
      return Number(res.headers.get('content-length'));
    },
    async head(key, bytes) {
      const res = await client.fetch(objectUrl(key), { headers: { Range: `bytes=0-${bytes - 1}` } });
      if (!res.ok) throw new Error(`Storage GET failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer()).slice(0, bytes);
    },
    async remove(key) {
      const res = await client.fetch(objectUrl(key), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`Storage DELETE failed: ${res.status}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Local disk, for development and tests only. URLs point at /api/files with an HMAC signature
// that mirrors S3's: operation, key, expiry and the response headers are all signed.
// ---------------------------------------------------------------------------
export type LocalGrant = { op: 'put' | 'get'; key: string; exp: number; ct: string; cd: string };

function localSignature(g: LocalGrant) {
  return keyedHash(`storage:${g.op}:${g.key}:${g.exp}:${g.ct}:${g.cd}`);
}

export function verifyLocalGrant(g: LocalGrant, sig: string, now = Date.now()) {
  return g.exp * 1000 > now && safeEqual(localSignature(g), sig);
}

export function localPath(key: string) {
  // Runtime data, not part of the build: keep the bundler from tracing the whole project.
  const root = resolve(/* turbopackIgnore: true */ env().STORAGE_DIR ?? '.storage');
  const path = resolve(/* turbopackIgnore: true */ root, key);
  if (!path.startsWith(root + sep)) throw new Error('Invalid storage key');
  return path;
}

function localProvider(): StorageProvider {
  if (process.env.NODE_ENV === 'production') throw new Error('Local storage is not allowed in production');
  const url = (g: LocalGrant) => {
    const u = new URL(`/api/files/${g.key}`, env().APP_URL);
    u.search = new URLSearchParams({
      op: g.op,
      exp: String(g.exp),
      ct: g.ct,
      cd: g.cd,
      sig: localSignature(g),
    }).toString();
    return u.pathname + u.search;
  };
  const exp = () => Math.floor(Date.now() / 1000) + SIGNED_URL_SECONDS;
  return {
    async uploadUrl(key, contentType) {
      return url({ op: 'put', key, exp: exp(), ct: contentType, cd: '' });
    },
    async downloadUrl(key, { fileName, contentType, inline }) {
      return url({ op: 'get', key, exp: exp(), ct: contentType, cd: disposition(fileName, inline) });
    },
    async size(key) {
      try {
        return (await stat(localPath(key))).size;
      } catch {
        return null;
      }
    },
    async head(key, bytes) {
      const file = await open(localPath(key), 'r');
      try {
        const buf = Buffer.alloc(bytes);
        const { bytesRead } = await file.read(buf, 0, bytes, 0);
        return new Uint8Array(buf.subarray(0, bytesRead));
      } finally {
        await file.close();
      }
    },
    async remove(key) {
      await rm(localPath(key), { force: true });
    },
  };
}

export async function ensureLocalDir(key: string) {
  await mkdir(dirname(localPath(key)), { recursive: true });
}

export function localReadStream(key: string) {
  return createReadStream(localPath(key));
}

export function storage(): StorageProvider {
  return env().STORAGE_PROVIDER === 's3' ? s3Provider() : localProvider();
}
