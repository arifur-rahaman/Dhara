import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { envSchema } from '@/server/env';

describe('.env.example', () => {
  it('lists every variable the app reads', () => {
    const example = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
    const listed = new Set([...example.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]));
    const missing = Object.keys(envSchema.shape).filter((key) => key !== 'NODE_ENV' && !listed.has(key));
    expect(missing).toEqual([]);
  });

  it('parses the example values', () => {
    const example = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8');
    const values = Object.fromEntries([...example.matchAll(/^([A-Z0-9_]+)=(.*)$/gm)].map((m) => [m[1], m[2]]));
    expect(envSchema.safeParse(values).success).toBe(true);
  });
});
