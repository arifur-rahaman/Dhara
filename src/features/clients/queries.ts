import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { can, type Ctx } from '@/server/authz';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { listCases, visibleCasesWhere, type CaseListItem } from '@/features/cases/queries';

/** Client names (P2) and their visible cases. No contact fields are selected here. */
export type ClientListItem = { id: string; name: string; caseCount: number };

function visibleClientsWhere(ctx: Ctx): Prisma.ClientWhereInput {
  const base: Prisma.ClientWhereInput = { chamberId: ctx.chamberId, deletedAt: null };
  // Associates see clients of the cases they can see (AssociateClient: "২টি কেস আপনাকে অ্যাসাইন করা").
  if (ctx.role === 'associate' && ctx.caseScope !== 'all') return { ...base, cases: { some: visibleCasesWhere(ctx) } };
  return base;
}

export async function listClients(ctx: Ctx, q?: string): Promise<ClientListItem[]> {
  if (!can.listClients(ctx)) return [];
  const rows = await withTenant(scopeOf(ctx), (tx) =>
    tx.client.findMany({
      where: {
        AND: [visibleClientsWhere(ctx), q?.trim() ? { displayName: { contains: q.trim(), mode: 'insensitive' } } : {}],
      },
      select: {
        id: true,
        displayName: true,
        _count: { select: { cases: { where: { AND: [visibleCasesWhere(ctx), { status: 'active' }] } } } },
      },
      orderBy: { displayName: 'asc' },
      take: 300,
    }),
  );
  return rows.map((r) => ({ id: r.id, name: r.displayName, caseCount: r._count.cases }));
}

export type ClientDetail = { id: string; name: string; cases: CaseListItem[] };

export async function getClient(ctx: Ctx, id: string): Promise<ClientDetail | null> {
  if (!can.listClients(ctx)) return null;
  const client = await withTenant(scopeOf(ctx), (tx) =>
    tx.client.findFirst({
      where: { AND: [visibleClientsWhere(ctx), { id }] },
      select: { id: true, displayName: true },
    }),
  );
  if (!client) return null;
  return { id: client.id, name: client.displayName, cases: await listCases(ctx, { clientId: id }) };
}

/** Names for the AddCase client field. */
export async function clientNameOptions(ctx: Ctx) {
  if (!can.listClients(ctx)) return [];
  return withTenant(scopeOf(ctx), (tx) =>
    tx.client.findMany({
      where: visibleClientsWhere(ctx),
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
      take: 500,
    }),
  );
}
