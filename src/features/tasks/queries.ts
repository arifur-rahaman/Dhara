import 'server-only';
import { addDays, dbDate, todayInDhaka, ymdFromDb, type Ymd } from '@/lib/dates';
import { can, type Ctx } from '@/server/authz';
import { scopeOf, withTenant } from '@/server/db/tenant';

export type TaskItem = {
  id: string;
  title: string;
  dueOn: Ymd | null;
  doneAt: Date | null;
  assigneeMembershipId: string;
  assigneeName: string | null;
  createdByName: string | null;
  mine: boolean;
};

/**
 * Tasks (P11). The owner sees everyone's; others see only tasks assigned to them.
 * Open tasks first (by due date), then those finished in the last 7 days.
 */
export async function listTasks(ctx: Ctx): Promise<{ open: TaskItem[]; done: TaskItem[] }> {
  const all = can.viewAllTasks(ctx);
  const since = dbDate(addDays(todayInDhaka(), -7));
  return withTenant(scopeOf(ctx), async (tx) => {
    const rows = await tx.task.findMany({
      where: {
        chamberId: ctx.chamberId,
        ...(all ? {} : { assigneeMembershipId: ctx.membershipId }),
        OR: [{ doneAt: null }, { doneAt: { gte: since } }],
      },
      orderBy: [{ dueOn: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 300,
    });
    const memberIds = [...new Set(rows.map((r) => r.assigneeMembershipId))];
    const userIds = [...new Set(rows.map((r) => r.createdBy))];
    const [members, creators] = await Promise.all([
      tx.membership.findMany({
        where: { id: { in: memberIds }, chamberId: ctx.chamberId },
        select: { id: true, user: { select: { name: true } } },
      }),
      tx.user.findMany({
        where: { id: { in: userIds }, memberships: { some: { chamberId: ctx.chamberId } } },
        select: { id: true, name: true },
      }),
    ]);
    const memberName = new Map(members.map((m) => [m.id, m.user.name]));
    const creatorName = new Map(creators.map((u) => [u.id, u.name]));
    const items = rows.map((r): TaskItem => ({
      id: r.id,
      title: r.title,
      dueOn: r.dueOn ? ymdFromDb(r.dueOn) : null,
      doneAt: r.doneAt,
      assigneeMembershipId: r.assigneeMembershipId,
      assigneeName: memberName.get(r.assigneeMembershipId) ?? null,
      createdByName: r.createdBy === ctx.userId ? null : (creatorName.get(r.createdBy) ?? null),
      mine: r.assigneeMembershipId === ctx.membershipId,
    }));
    return {
      open: items.filter((i) => !i.doneAt),
      done: items.filter((i) => i.doneAt).sort((a, b) => +b.doneAt! - +a.doneAt!),
    };
  });
}

/** Members the owner can give a task to. */
export async function taskAssignees(ctx: Ctx) {
  if (!can.assignTask(ctx)) return [];
  return withTenant(scopeOf(ctx), (tx) =>
    tx.membership.findMany({
      where: { chamberId: ctx.chamberId, status: 'active' },
      select: { id: true, role: true, userId: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  );
}
