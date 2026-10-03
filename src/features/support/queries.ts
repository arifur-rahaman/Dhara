import 'server-only';
import { can, type Ctx } from '@/server/authz';
import { scopeOf, withTenant } from '@/server/db/tenant';

export type GrantState = 'pending' | 'active' | 'ended';

export type SupportRequest = {
  id: string;
  adminName: string;
  reason: string;
  requestedAt: Date;
  approvedAt: Date | null;
  expiresAt: Date | null;
  state: GrantState;
};

export function grantState(
  g: { approvedAt: Date | null; rejectedAt: Date | null; revokedAt: Date | null; expiresAt: Date | null },
  now = new Date(),
): GrantState {
  if (g.rejectedAt || g.revokedAt) return 'ended';
  if (!g.approvedAt) return 'pending';
  return g.expiresAt && g.expiresAt > now ? 'active' : 'ended';
}

/** Support access requests for this chamber (P13, owner only), newest first. */
export async function supportRequests(ctx: Ctx, take = 20): Promise<SupportRequest[]> {
  if (!can.approveSupportAccess(ctx)) return [];
  return withTenant(scopeOf(ctx), async (tx) => {
    const grants = await tx.supportGrant.findMany({
      where: { chamberId: ctx.chamberId },
      orderBy: { requestedAt: 'desc' },
      take,
    });
    const admins = await tx.platformAdmin.findMany({
      where: { id: { in: [...new Set(grants.map((g) => g.adminId))] } },
      select: { id: true, name: true },
    });
    const name = new Map(admins.map((a) => [a.id, a.name]));
    return grants.map((g) => ({
      id: g.id,
      adminName: name.get(g.adminId) ?? '',
      reason: g.reason,
      requestedAt: g.requestedAt,
      approvedAt: g.approvedAt,
      expiresAt: g.expiresAt,
      state: grantState(g),
    }));
  });
}

/** For the owner's Today banner: open requests and live grants. */
export async function supportBanner(ctx: Ctx) {
  const list = await supportRequests(ctx, 10);
  return { pending: list.filter((g) => g.state === 'pending').length, active: list.find((g) => g.state === 'active') };
}
