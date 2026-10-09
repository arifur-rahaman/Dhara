import 'server-only';
import { addDays, todayInDhaka } from '@/lib/dates';
import type { Ctx } from '@/server/authz';
import { withTenant } from '@/server/db/tenant';

export type NoticeRow = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  read: boolean;
  day: string;
};

/** The last 30 days of notices for this person in the current chamber (Notifications design). */
export async function listNotifications(ctx: Ctx): Promise<NoticeRow[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await withTenant({ userId: ctx.userId }, (tx) =>
    tx.notification.findMany({
      where: { userId: ctx.userId, createdAt: { gte: since }, OR: [{ chamberId: ctx.chamberId }, { chamberId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  );
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    payload: (n.payload ?? {}) as Record<string, unknown>,
    createdAt: n.createdAt,
    read: !!n.readAt,
    day: todayInDhaka(n.createdAt),
  }));
}

export async function unreadCount(ctx: Ctx) {
  return withTenant({ userId: ctx.userId }, (tx) =>
    tx.notification.count({
      where: { userId: ctx.userId, readAt: null, OR: [{ chamberId: ctx.chamberId }, { chamberId: null }] },
    }),
  );
}

export const yesterdayInDhaka = () => addDays(todayInDhaka(), -1);
