import { describe, expect, it } from 'vitest';
import { isAllowedType, sniffType } from '@/features/documents/files';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('document file checks', () => {
  it('recognises PDF, JPEG and PNG by their first bytes', () => {
    expect(sniffType(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
  });

  it('refuses anything else, whatever it is called', () => {
    expect(sniffType(new TextEncoder().encode('MZ\x90\x00'))).toBeNull();
    expect(sniffType(new TextEncoder().encode('<html>'))).toBeNull();
    expect(sniffType(bytes())).toBeNull();
    expect(isAllowedType('image/heic')).toBe(false);
    expect(isAllowedType('text/html')).toBe(false);
  });
});
