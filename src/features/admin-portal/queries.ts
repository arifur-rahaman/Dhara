import 'server-only';
import type { AdminCtx } from '@/server/admin/session';
import { adminDb, withAdmin } from '@/server/db/admin-client';
import { grantState, type GrantState } from '@/features/support/queries';

/**
 * Reads for the admin portal. Everything here goes through the dhara_admin role, which can see
 * chamber account fields, counts, owners' name and login phone, and nothing from client tables.
 */
export type ChamberRow = {
  id: string;
  name: string;
  district: string;
  plan: string;
  status: string;
  trial_ends_at: Date | null;
  created_at: Date;
  owner_name: string | null;
  owner_phone: string | null;
  member_count: number;
  case_count: number;
};

export type SupportSummary = { state: GrantState; hoursLeft: number; adminId: string };

export async function chamberOverview(q = ''): Promise<ChamberRow[]> {
  const term = q.trim();
  return term
    ? adminDb.$queryRaw<ChamberRow[]>`
        SELECT * FROM admin_chamber_overview
        WHERE name ILIKE ${`%${term}%`} OR owner_name ILIKE ${`%${term}%`} OR district ILIKE ${`%${term}%`}
        ORDER BY created_at DESC LIMIT 200`
    : adminDb.$queryRaw<ChamberRow[]>`SELECT * FROM admin_chamber_overview ORDER BY created_at DESC LIMIT 200`;
}

export async function chamberById(id: string): Promise<ChamberRow | null> {
  const rows = await adminDb.$queryRaw<ChamberRow[]>`SELECT * FROM admin_chamber_overview WHERE id = ${id}::uuid`;
  return rows[0] ?? null;
}

/** Latest support grant per chamber, for the chamber list's "Support access" column. */
export async function latestSupport(chamberIds: string[]): Promise<Map<string, SupportSummary>> {
  if (chamberIds.length === 0) return new Map();
  const grants = await adminDb.supportGrant.findMany({
    where: { chamberId: { in: chamberIds } },
    orderBy: { requestedAt: 'desc' },
  });
  const out = new Map<string, SupportSummary>();
  const now = Date.now();
  for (const g of grants) {
    if (out.has(g.chamberId)) continue;
    const hoursLeft = g.expiresAt ? Math.max(1, Math.ceil((g.expiresAt.getTime() - now) / 3_600_000)) : 0;
    out.set(g.chamberId, { state: grantState(g), hoursLeft, adminId: g.adminId });
  }
  return out;
}

export async function supportGrants(take = 100) {
  const grants = await adminDb.supportGrant.findMany({ orderBy: { requestedAt: 'desc' }, take });
  const [chambers, admins] = await Promise.all([
    adminDb.chamber.findMany({
      where: { id: { in: [...new Set(grants.map((g) => g.chamberId))] } },
      select: { id: true, name: true },
    }),
    adminNames(grants.map((g) => g.adminId)),
  ]);
  const chamberName = new Map(chambers.map((c) => [c.id, c.name]));
  return grants.map((g) => ({
    ...g,
    state: grantState(g),
    chamberName: chamberName.get(g.chamberId) ?? '',
    adminName: admins.get(g.adminId) ?? '',
  }));
}

export async function chamberGrants(chamberId: string) {
  const grants = await adminDb.supportGrant.findMany({
    where: { chamberId },
    orderBy: { requestedAt: 'desc' },
    take: 20,
  });
  const admins = await adminNames(grants.map((g) => g.adminId));
  return grants.map((g) => ({ ...g, state: grantState(g), adminName: admins.get(g.adminId) ?? '' }));
}

/** Case numbers and dates during an approved grant. The database function refuses otherwise and logs each call. */
export async function supportCases(admin: AdminCtx, chamberId: string) {
  return withAdmin(
    admin.id,
    (tx) =>
      tx.$queryRaw<
        {
          case_type: string;
          number: string;
          year: string;
          court_name: string;
          court_no: string | null;
          next_date: Date | null;
          status: string;
        }[]
      >`SELECT * FROM admin_support_cases(${chamberId}::uuid)`,
  );
}

export async function payments(chamberId?: string) {
  const rows = await adminDb.subscriptionPayment.findMany({
    where: chamberId ? { chamberId } : {},
    orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });
  const [chambers, admins] = await Promise.all([
    adminDb.chamber.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.chamberId))] } },
      select: { id: true, name: true },
    }),
    adminNames(rows.map((r) => r.recordedBy)),
  ]);
  const chamberName = new Map(chambers.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    ...r,
    chamberName: chamberName.get(r.chamberId) ?? '',
    recordedByName: admins.get(r.recordedBy) ?? '',
  }));
}

export async function dashboardStats() {
  const [rows] = await adminDb.$queryRaw<
    { chambers: number; trials: number; paid: number; past_due: number; members: number }[]
  >`SELECT count(*)::int AS chambers,
           count(*) FILTER (WHERE plan = 'trial')::int AS trials,
           count(*) FILTER (WHERE plan <> 'trial' AND status = 'active')::int AS paid,
           count(*) FILTER (WHERE status = 'past_due')::int AS past_due,
           coalesce(sum(member_count), 0)::int AS members
      FROM admin_chamber_overview`;
  const grants = await adminDb.supportGrant.findMany({
    where: { rejectedAt: null, revokedAt: null, OR: [{ approvedAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { approvedAt: true, rejectedAt: true, revokedAt: true, expiresAt: true },
  });
  return {
    ...rows,
    pendingSupport: grants.filter((g) => grantState(g) === 'pending').length,
    activeSupport: grants.filter((g) => grantState(g) === 'active').length,
  };
}

export async function adminTeam() {
  return adminDb.platformAdmin.findMany({
    select: { id: true, name: true, phone: true, role: true, disabledAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function adminAuditLog(take = 200) {
  const rows = await adminDb.adminAuditLog.findMany({ orderBy: { at: 'desc' }, take });
  const [admins, chambers] = await Promise.all([
    adminNames(rows.map((r) => r.adminId).filter((id): id is string => !!id)),
    adminDb.chamber.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.chamberId).filter((id): id is string => !!id))] } },
      select: { id: true, name: true },
    }),
  ]);
  const chamberName = new Map(chambers.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    action: r.action,
    adminName: r.adminId ? (admins.get(r.adminId) ?? '') : '',
    chamberName: r.chamberId ? (chamberName.get(r.chamberId) ?? '') : '',
  }));
}

async function adminNames(ids: string[]) {
  const admins = await adminDb.platformAdmin.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, name: true },
  });
  return new Map(admins.map((a) => [a.id, a.name]));
}
