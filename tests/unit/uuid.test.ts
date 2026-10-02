import { describe, expect, it } from 'vitest';
import { uuidv7 } from '@/lib/uuid';

describe('uuidv7', () => {
  it('is a valid version 7 UUID', () => {
    expect(uuidv7()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('encodes the current time so ids sort by creation', () => {
    const before = Date.now();
    const id = uuidv7();
    const ms = parseInt(id.replace(/-/g, '').slice(0, 12), 16);
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(Date.now());
  });
});
