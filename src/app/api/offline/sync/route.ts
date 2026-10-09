import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isYmd, todayInDhaka } from '@/lib/dates';
import { can, ForbiddenError } from '@/server/authz';
import { getCtx } from '@/server/context';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { applyNextDate } from '@/features/cases/next-date';
import type { SyncResult } from '@/features/offline/types';

/**
 * Offline outbox (F21, TECH_GUIDE section 11). Each change carries a key made on the phone; a key that was
 * already applied returns its earlier result and changes nothing, so retries after a dropped connection
 * are safe. Every change goes through the same permission checks as the screens.
 */
const item = z.discriminatedUnion('kind', [
  z.object({
    key: z.uuid(),
    kind: z.literal('nextDate'),
    payload: z.object({ caseId: z.uuid(), date: z.string().refine(isYmd), note: z.string().max(500) }),
  }),
  z.object({ key: z.uuid(), kind: z.literal('taskDone'), payload: z.object({ taskId: z.uuid() }) }),
]);
const body = z.object({ items: z.array(z.unknown()).max(50) });

export async function POST(request: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: 'signedOut' }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const results: SyncResult[] = [];
  for (const raw of parsed.data.items) {
    const one = item.safeParse(raw);
    const key = typeof (raw as { key?: unknown })?.key === 'string' ? String((raw as { key: string }).key) : '';
    if (!one.success) {
      results.push({ key, result: 'invalid' });
      continue;
    }
    const it = one.data;
    try {
      const result = await withTenant(scopeOf(ctx), async (tx) => {
        const seen = await tx.syncReceipt.findUnique({ where: { key: it.key } });
        if (seen) return (seen.result as { result: SyncResult['result'] }).result;
        let r: SyncResult['result'];
        if (it.kind === 'nextDate') {
          r = await applyNextDate(
            tx,
            ctx,
            { caseId: it.payload.caseId, date: it.payload.date, note: it.payload.note.trim() || null },
            todayInDhaka(),
          );
        } else {
          const task = await tx.task.findFirst({ where: { id: it.payload.taskId, chamberId: ctx.chamberId } });
          if (!task) r = 'notFound';
          else if (!can.completeTask(ctx, task)) r = 'denied';
          else {
            if (!task.doneAt) await tx.task.update({ where: { id: task.id }, data: { doneAt: new Date() } });
            r = 'ok';
          }
        }
        await tx.syncReceipt.createMany({
          data: { key: it.key, userId: ctx.userId, chamberId: ctx.chamberId, kind: it.kind, result: { result: r } },
        });
        return r;
      });
      results.push({ key: it.key, result });
    } catch (e) {
      results.push({ key: it.key, result: e instanceof ForbiddenError ? 'denied' : 'invalid' });
    }
  }
  return NextResponse.json({ results });
}
