'use server';

import { revalidatePath } from 'next/cache';
import { audit } from '@/server/audit';
import { assertCan, can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { checkRows, importInput, saveRows, type PreviewRow } from './server';

export type PreviewResult = { ok: true; rows: PreviewRow[] } | { ok: false; error: 'invalid' | 'assignee' };
export type CommitResult =
  | { ok: true; cases: number; clients: number; hearings: number; skipped: number }
  | { ok: false; error: 'invalid' | 'assignee' | 'nothing' };

/** Step 3 of the import wizard (F20): what would happen to each row. Nothing is saved. */
export async function previewImport(input: unknown): Promise<PreviewResult> {
  const ctx = await requireCtx();
  assertCan('importCases', ctx);
  const parsed = importInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { preview } = await withTenant(scopeOf(ctx), (tx) => checkRows(tx, ctx, parsed.data));
  return { ok: true, rows: preview };
}

/**
 * Saves the rows that are ready; duplicates and rows with problems are skipped. Rows are checked again
 * here, never trusted from the preview. An associate's imported cases are assigned to them, like Add case.
 */
export async function commitImport(input: unknown): Promise<CommitResult> {
  const ctx = await requireCtx();
  assertCan('importCases', ctx);
  const parsed = importInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const data = parsed.data;

  const result = await withTenant(scopeOf(ctx), async (tx) => {
    let assignee: string | null = ctx.membershipId;
    if (data.assignee && data.assignee !== ctx.membershipId) {
      if (!can.assignCase(ctx)) return { ok: false as const, error: 'assignee' as const };
      const member = await tx.membership.findFirst({
        where: { id: data.assignee, chamberId: ctx.chamberId, status: 'active', role: { in: ['owner', 'associate'] } },
        select: { id: true },
      });
      if (!member) return { ok: false as const, error: 'assignee' as const };
      assignee = member.id;
    }
    const { preview, ready } = await checkRows(tx, ctx, data);
    if (!ready.length) return { ok: false as const, error: 'nothing' as const };
    const saved = await saveRows(tx, ctx, ready, assignee);
    await audit(tx, {
      chamberId: ctx.chamberId,
      actorUserId: ctx.userId,
      action: 'import.cases',
      entity: 'case',
      fields: {
        cases: saved.cases,
        clients: saved.clients,
        hearings: saved.hearings,
        skipped: preview.length - ready.length,
      },
    });
    return { ok: true as const, ...saved, skipped: preview.length - ready.length };
  });
  if (result.ok) {
    revalidatePath('/cases');
    revalidatePath('/today');
  }
  return result;
}
