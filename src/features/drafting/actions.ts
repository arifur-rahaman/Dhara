'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { draftProvider } from '@/server/providers/ai-draft';
import { checklist, outline } from './kinds';
import { restore } from './redact';
import { draftInput, namesToHide, redactInput } from './server';

export type CheckResult =
  | { ok: true; sent: string; items: { key: string; found: boolean; question: string }[] }
  | { ok: false; error: 'notAllowed' | 'invalid' | 'notFound' | 'unavailable' };

/**
 * Step 1 of a draft (AIDraft design): which checklist items the facts already give, and a question for
 * each missing one. Shows the lawyer exactly what was sent (`sent`, with names as placeholders).
 */
export async function checkDraft(input: unknown): Promise<CheckResult> {
  const ctx = await requireCtx();
  if (!can.useAi(ctx)) return { ok: false, error: 'notAllowed' };
  const parsed = draftInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const names = await namesToHide(ctx, parsed.data);
  if (!names) return { ok: false, error: 'notFound' };
  const { facts, map } = redactInput(parsed.data, names);
  const keys = checklist[parsed.data.kind];
  const result = await draftProvider().checkFacts({
    kind: parsed.data.kind,
    language: parsed.data.language,
    facts,
    checklist: keys,
    outline: outline[parsed.data.kind][parsed.data.language],
  });
  if (!result) return { ok: false, error: 'unavailable' };
  // Only the keys we asked about, in our order; the model's wording is shown with names put back.
  const byKey = new Map(result.items.map((i) => [i.key, i]));
  return {
    ok: true,
    sent: facts,
    items: keys.map((key) => {
      const item = byKey.get(key);
      return { key, found: item?.found ?? false, question: restore(item?.question ?? '', map).slice(0, 300) };
    }),
  };
}

/** Hides a draft (soft delete). The writer or the owner. */
export async function deleteDraft(form: FormData) {
  const ctx = await requireCtx();
  const id = z.uuid().parse(form.get('id'));
  await withTenant(scopeOf(ctx), (tx) =>
    tx.aiDraft.updateMany({
      where: { id, chamberId: ctx.chamberId, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
  );
  revalidatePath('/drafts');
}
