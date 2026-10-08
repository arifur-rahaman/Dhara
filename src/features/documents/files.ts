/**
 * Allowed document files (TECH_GUIDE section 13). Shared by the browser (to explain early)
 * and the server (which checks the real bytes after upload).
 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type AllowedType = (typeof allowedTypes)[number];

export const extensionOf: Record<AllowedType, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export function isAllowedType(value: string): value is AllowedType {
  return (allowedTypes as readonly string[]).includes(value);
}

/** What the first bytes say the file is, whatever its name or claimed type. */
export function sniffType(bytes: Uint8Array): AllowedType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf'; // %PDF-
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  return null;
}
