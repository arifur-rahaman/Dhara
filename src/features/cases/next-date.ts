import 'server-only';
import { dbDate } from '@/lib/dates';
import { assertCan, type Ctx } from '@/server/authz';
import type { Tx } from '@/server/db/client';
import { notifyMembers } from '@/features/notifications/notify';
import { visibleCasesWhere } from './queries';

/**
 * The next-date write itself, shared by the form and the offline outbox (F18, F21).
 * 'exists' means the case already had that date (for example someone else added it while this phone
 * was offline); the note is still recorded, and nothing is duplicated.
 */
export async function applyNextDate(
  tx: Tx,
  ctx: Ctx,
  input: { caseId: string; date: string; note?: string | null; serial?: string | null },
  today: string,
): Promise<'ok' | 'exists' | 'notFound'> {
  const { caseId, date, note, serial } = input;
  const c = await tx.case.findFirst({
    where: { AND: [visibleCasesWhere(ctx), { id: caseId }] },
    select: { id: true, type: true, number: true, year: true, assigneeMembershipId: true },
  });
  if (!c) return 'notFound';
  assertCan('addHearing', ctx, { assigneeMembershipId: c.assigneeMembershipId });

  if (note) {
    // The most recent hearing up to today gets today's note; if there is none, today's entry is created.
    const last = await tx.hearing.findFirst({
      where: { caseId, date: { lte: dbDate(today) }, outcomeNote: null },
      orderBy: { date: 'desc' },
    });
    if (last) await tx.hearing.update({ where: { id: last.id }, data: { outcomeNote: note, outcomeBy: ctx.userId } });
    else
      await tx.hearing.create({
        data: {
          chamberId: ctx.chamberId,
          caseId,
          date: dbDate(today),
          outcomeNote: note,
          outcomeBy: ctx.userId,
          addedBy: ctx.userId,
        },
      });
  }
  const same = await tx.hearing.findFirst({ where: { caseId, date: dbDate(date) }, select: { id: true } });
  if (same) return 'exists';
  await tx.hearing.create({
    data: { chamberId: ctx.chamberId, caseId, date: dbDate(date), serialOrItem: serial, addedBy: ctx.userId },
  });

  // The owner and the assignee see it at once in their notification centre (Notifications design).
  const people = await tx.membership.findMany({
    where: {
      chamberId: ctx.chamberId,
      status: 'active',
      OR: [{ role: 'owner' }, ...(c.assigneeMembershipId ? [{ id: c.assigneeMembershipId }] : [])],
    },
    select: { userId: true },
  });
  await notifyMembers(
    tx,
    ctx,
    people.map((p) => p.userId),
    'hearing.added',
    { caseId, type: c.type, number: c.number, year: c.year, date, by: ctx.userId },
  );
  return 'ok';
}
