import { afterAll, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';
import { localPath, storage, verifyLocalGrant } from '@/server/providers/storage';

/**
 * Storage provider contract. Runs against local disk always, and against S3-compatible storage
 * (MinIO in CI) when STORAGE_PROVIDER=s3 and the S3_* variables are set.
 */
process.env.STORAGE_DIR ??= 'test-results/storage';
afterAll(async () => {
  await rm('test-results/storage', { recursive: true, force: true });
});

describe(`storage (${process.env.STORAGE_PROVIDER ?? 'local'})`, () => {
  const key = `chambers/test/cases/test/${Date.now()}.pdf`;

  it('uploads with a signed URL, reads size and first bytes, downloads, and removes', async () => {
    const s = storage();
    const body = new TextEncoder().encode('%PDF-1.4 test body');
    const up = await s.uploadUrl(key, 'application/pdf');
    if (process.env.STORAGE_PROVIDER === 's3') {
      const res = await fetch(up, { method: 'PUT', body, headers: { 'Content-Type': 'application/pdf' } });
      expect(res.status).toBe(200);
      expect(await s.size(key)).toBe(body.byteLength);
      expect(new TextDecoder().decode(await s.head(key, 5))).toBe('%PDF-');
      const down = await fetch(await s.downloadUrl(key, { fileName: 'রসিদ.pdf', contentType: 'application/pdf' }));
      expect(down.status).toBe(200);
      expect(down.headers.get('content-disposition')).toContain("filename*=UTF-8''%E0%A6%B0");
      await s.remove(key);
      expect(await s.size(key)).toBeNull();
    } else {
      // Local URLs are app routes; check the signature rules directly.
      const q = new URL(up, 'http://x').searchParams;
      const grant = { op: 'put' as const, key, exp: Number(q.get('exp')), ct: q.get('ct')!, cd: q.get('cd')! };
      expect(verifyLocalGrant(grant, q.get('sig')!)).toBe(true);
      expect(verifyLocalGrant({ ...grant, op: 'get' }, q.get('sig')!)).toBe(false);
      expect(verifyLocalGrant({ ...grant, key: `${key}x` }, q.get('sig')!)).toBe(false);
      expect(verifyLocalGrant(grant, q.get('sig')!, (grant.exp + 1) * 1000)).toBe(false);
      expect(await s.size(key)).toBeNull();
    }
  });

  it('local keys cannot escape the storage folder', () => {
    expect(() => localPath('../../etc/passwd')).toThrow(/Invalid storage key/);
  });
});
