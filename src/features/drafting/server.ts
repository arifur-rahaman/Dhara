import 'server-only';
import { z } from 'zod';
import type { Ctx } from '@/server/authz';
import { decryptField, encryptField } from '@/server/crypto';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { visibleCasesWhere } from '@/features/cases/queries';
import { draftKinds } from './kinds';
import { redact, type RedactionMap } from './redact';

export const draftInput = z.object({
  kind: z.enum(draftKinds),
  language: z.enum(['en', 'bn']),
  facts: z.string().trim().min(20).max(12_000),
  /** Extra names the lawyer wants hidden (people in the facts the app does not know). */
  names: z.array(z.string().trim().max(120)).max(30),
  caseId: z.uuid().nullable(),
});
export type DraftInput = z.infer<typeof draftInput>;

/** Splits "Md. Karim Hossain বনাম Rafiq Uddin গং" into the names it holds. */
export function partyNames(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\s+(?:বনাম|vs\.?|v\.|versus)\s+|[,;\n]|\s+(?:গং|ও|and)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
}

/**
 * The names to hide for this draft: the linked case's client, parties and opposing counsel, plus any the
 * lawyer added. Returns null when the case is not one this person can see.
 */
export async function namesToHide(ctx: Ctx, input: DraftInput): Promise<string[] | null> {
  const extra = input.names.filter(Boolean);
  if (!input.caseId) return extra;
  const c = await withTenant(scopeOf(ctx), (tx) =>
    tx.case.findFirst({
      where: { AND: [visibleCasesWhere(ctx), { id: input.caseId! }] },
      select: { partiesText: true, opposingCounsel: true, client: { select: { displayName: true } } },
    }),
  );
  if (!c) return null;
  return [c.client?.displayName ?? '', ...partyNames(c.partiesText), c.opposingCounsel ?? '', ...extra].filter(Boolean);
}

export function redactInput(input: DraftInput, names: string[]): { facts: string; map: RedactionMap } {
  const { text, map } = redact(input.facts, names);
  return { facts: text, map };
}

export const sealMap = (map: RedactionMap) => encryptField(JSON.stringify(map));
export function openMap(enc: string): RedactionMap {
  try {
    return JSON.parse(decryptField(enc)) as RedactionMap;
  } catch {
    return {};
  }
}
