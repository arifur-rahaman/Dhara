'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { dbDate, isYmd } from '@/lib/dates';
import { assertCan, can } from '@/server/authz';
import { requireCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import type { FormState } from '@/features/auth/actions';

const taskInput = z.object({
  title: z.string().trim().min(2).max(300),
  assignee: z.uuid(),
  dueOn: z.string().refine((v) => v === '' || isYmd(v)),
});

/** Owner gives a task to a member (P11). */
export async function createTask(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  assertCan('assignTask', ctx);
  const values = {
    title: String(form.get('title') ?? ''),
    assignee: String(form.get('assignee') ?? ''),
    dueOn: String(form.get('dueOn') ?? ''),
  };
  const parsed = taskInput.safeParse(values);
  if (!parsed.success) return { error: 'taskInvalid', values };

  const ok = await withTenant(scopeOf(ctx), async (tx) => {
    const member = await tx.membership.findFirst({
      where: { id: parsed.data.assignee, chamberId: ctx.chamberId, status: 'active' },
      select: { id: true },
    });
    if (!member) return false;
    await tx.task.create({
      data: {
        chamberId: ctx.chamberId,
        assigneeMembershipId: member.id,
        title: parsed.data.title,
        dueOn: parsed.data.dueOn ? dbDate(parsed.data.dueOn) : null,
        createdBy: ctx.userId,
      },
    });
    return true;
  });
  if (!ok) return { error: 'taskInvalid', values };
  revalidatePath('/tasks');
  return { ok: true, at: Date.now() };
}

/** The assignee (or the owner) ticks a task off, or reopens it. */
export async function toggleTask(form: FormData) {
  const ctx = await requireCtx();
  const id = z.uuid().parse(form.get('taskId'));
  const done = form.get('done') === '1';
  await withTenant(scopeOf(ctx), async (tx) => {
    const task = await tx.task.findFirst({ where: { id, chamberId: ctx.chamberId } });
    if (!task || !can.completeTask(ctx, task)) return;
    await tx.task.update({ where: { id }, data: { doneAt: done ? new Date() : null } });
  });
  revalidatePath('/tasks');
  revalidatePath('/today');
}
