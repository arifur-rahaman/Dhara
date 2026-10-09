'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCtx } from '@/server/context';
import { withTenant } from '@/server/db/tenant';

/** Marks a module done or not done for the signed-in person only. */
export async function setModuleDone(form: FormData) {
  const ctx = await requireCtx();
  const moduleId = z.string().max(100).parse(form.get('moduleId'));
  const done = form.get('done') === '1';
  await withTenant({ userId: ctx.userId }, async (tx) => {
    const exists = await tx.courseModule.findUnique({ where: { id: moduleId }, select: { id: true } });
    if (!exists) return;
    if (done) {
      // ON CONFLICT DO NOTHING: the app role has no UPDATE on progress rows.
      await tx.courseProgress.createMany({ data: { userId: ctx.userId, moduleId }, skipDuplicates: true });
    } else {
      await tx.courseProgress.deleteMany({ where: { userId: ctx.userId, moduleId } });
    }
  });
  revalidatePath('/courses', 'layout');
}
