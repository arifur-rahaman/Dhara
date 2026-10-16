import { z } from 'zod';
import raw from '../../../content/guide.bn.json';

/**
 * The user guide (Bangla), kept in content/guide.bn.json so it is updated in the same change as the
 * feature it describes (CLAUDE.md). Inline markup: **bold**, [[button or menu label]].
 */
const block = z.union([
  z.object({ h: z.string() }),
  z.object({ p: z.string() }),
  z.object({ steps: z.array(z.string()).min(1) }),
  z.object({ list: z.array(z.string()).min(1) }),
  z.object({ note: z.string() }),
  z.object({ lock: z.string() }),
  z.object({ table: z.object({ head: z.array(z.string()), rows: z.array(z.array(z.string())) }) }),
]);

export const guideSchema = z.object({
  title: z.string(),
  intro: z.string(),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  footer: z.string(),
  sections: z
    .array(z.object({ id: z.string().regex(/^[a-z][a-z0-9-]*$/), title: z.string(), blocks: z.array(block).min(1) }))
    .min(1),
});

export type Guide = z.infer<typeof guideSchema>;
export type GuideBlock = z.infer<typeof block>;

export const guide: Guide = guideSchema.parse(raw);

/** Splits **bold** and [[label]] markup into parts for rendering. */
export function inline(text: string): { kind: 'text' | 'bold' | 'ui'; text: string }[] {
  return text
    .split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**')
        ? { kind: 'bold' as const, text: part.slice(2, -2) }
        : part.startsWith('[[')
          ? { kind: 'ui' as const, text: part.slice(2, -2) }
          : { kind: 'text' as const, text: part },
    );
}
