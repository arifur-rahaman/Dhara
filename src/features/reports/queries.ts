import 'server-only';
import { addMonths, dbDate, monthStart, todayInDhaka, type Ymd } from '@/lib/dates';
import { can, type Ctx } from '@/server/authz';
import { scopeOf, withTenant } from '@/server/db/tenant';

export const ranges = { month: 1, half: 6, year: 12 } as const;
export type Range = keyof typeof ranges;

/**
 * Monthly report (F23, Reports design), owner only: collection per month, dues, active cases,
 * this month's hearings, and active cases by court. Counts and sums only.
 */
export async function reportData(ctx: Ctx, range: Range) {
  if (!can.viewReports(ctx)) return null;
  const thisMonth = monthStart(todayInDhaka());
  const months: Ymd[] = Array.from({ length: ranges[range] }, (_, i) => addMonths(thisMonth, i - ranges[range] + 1));
  const from = dbDate(months[0]);
  const next = dbDate(addMonths(thisMonth, 1));

  return withTenant(scopeOf(ctx), async (tx) => {
    const [byMonth, dues, activeCases, hearings, byCourt] = await Promise.all([
      tx.$queryRaw<{ month: string; total: bigint }[]>`
        SELECT to_char(date_trunc('month', paid_on), 'YYYY-MM-DD') AS month, sum(amount_poisha) AS total
        FROM payments WHERE chamber_id = ${ctx.chamberId}::uuid AND paid_on >= ${from} AND paid_on < ${next}
        GROUP BY 1`,
      // Each case's due counted only when positive, as on the Accounts screen.
      tx.$queryRaw<{ due: bigint }[]>`
        SELECT coalesce(sum(greatest(coalesce(f.total, 0) - coalesce(p.total, 0), 0)), 0) AS due
        FROM cases k
        LEFT JOIN (SELECT case_id, sum(amount_poisha) AS total FROM fees WHERE deleted_at IS NULL GROUP BY 1) f ON f.case_id = k.id
        LEFT JOIN (SELECT case_id, sum(amount_poisha) AS total FROM payments GROUP BY 1) p ON p.case_id = k.id
        WHERE k.chamber_id = ${ctx.chamberId}::uuid AND k.deleted_at IS NULL`,
      tx.case.count({ where: { chamberId: ctx.chamberId, deletedAt: null, status: 'active' } }),
      tx.hearing.count({
        where: { chamberId: ctx.chamberId, date: { gte: dbDate(thisMonth), lt: next }, case: { deletedAt: null } },
      }),
      tx.case.groupBy({
        by: ['courtId'],
        where: { chamberId: ctx.chamberId, deletedAt: null, status: 'active' },
        _count: { _all: true },
      }),
    ]);
    const courts = await tx.court.findMany({
      where: { id: { in: byCourt.map((c) => c.courtId) } },
      select: { id: true, nameBn: true, nameEn: true, level: true, district: true },
    });
    const courtById = new Map(courts.map((c) => [c.id, c]));
    const totals = new Map(byMonth.map((r) => [r.month, Number(r.total)]));
    return {
      months: months.map((m) => ({ month: m, poisha: totals.get(m) ?? 0 })),
      thisMonth,
      duePoisha: Number(dues[0]?.due ?? 0),
      activeCases,
      hearingsThisMonth: hearings,
      byCourt: byCourt
        .map((c) => ({ court: courtById.get(c.courtId)!, count: c._count._all }))
        .sort((a, b) => b.count - a.count),
    };
  });
}
