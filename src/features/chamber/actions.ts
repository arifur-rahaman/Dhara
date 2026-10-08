'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertCan } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import type { FormState } from '@/features/auth/actions';

const input = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(200),
});

/** Chamber name and address, printed on receipts (P12: chamber settings are the owner's). */
export async function saveChamberDetails(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('editChamberSettings', ctx);
  const values = { name: String(form.get('name') ?? ''), address: String(form.get('address') ?? '') };
  const parsed = input.safeParse(values);
  if (!parsed.success) return { error: 'chamberInvalid', values };
  await withTenant(scopeOf(ctx), (tx) =>
    tx.chamber.updateMany({
      where: { id: ctx.chamberId },
      data: { name: parsed.data.name, address: parsed.data.address || null },
    }),
  );
  revalidatePath('/settings');
  return { ok: true, at: Date.now() };
}
