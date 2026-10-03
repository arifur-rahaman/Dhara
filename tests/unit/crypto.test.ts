import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEYS = JSON.stringify({
    v1: Buffer.alloc(32, 1).toString('base64'),
    v2: Buffer.alloc(32, 2).toString('base64'),
  });
  process.env.FIELD_ENCRYPTION_ACTIVE = 'v2';
  process.env.SESSION_SECRET = 'unit-test-secret-unit-test-secret-000000';
});

describe('field encryption (AES-256-GCM)', () => {
  it('round-trips and never stores the plain value', async () => {
    const { encryptField, decryptField } = await import('@/server/crypto');
    const stored = encryptField('+8801712345678');
    expect(stored).not.toContain('8801712345678');
    expect(stored.startsWith('v2:')).toBe(true);
    expect(decryptField(stored)).toBe('+8801712345678');
  });

  it('uses a fresh IV each time', async () => {
    const { encryptField } = await import('@/server/crypto');
    expect(encryptField('same')).not.toBe(encryptField('same'));
  });

  it('still reads values written with an older key version', async () => {
    const { decryptField } = await import('@/server/crypto');
    const { createCipheriv } = await import('node:crypto');
    const iv = Buffer.alloc(12, 9);
    const cipher = createCipheriv('aes-256-gcm', Buffer.alloc(32, 1), iv);
    const data = Buffer.concat([cipher.update('old', 'utf8'), cipher.final()]);
    const stored = ['v1', iv.toString('base64'), data.toString('base64'), cipher.getAuthTag().toString('base64')].join(
      ':',
    );
    expect(decryptField(stored)).toBe('old');
  });

  it('rejects tampered ciphertext', async () => {
    const { encryptField, decryptField } = await import('@/server/crypto');
    const [v, iv, data, tag] = encryptField('secret').split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    expect(() => decryptField([v, iv, flipped.toString('base64'), tag].join(':'))).toThrow();
  });
});
