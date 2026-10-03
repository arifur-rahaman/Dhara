import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { addDays, dbDate, todayInDhaka, ymdFromDb, type Ymd } from '@/lib/dates';
import { can, type Ctx } from '@/server/authz';
import { scopeOf, withTenant } from '@/server/db/tenant';
import type { CourtRef } from './format';

/**
 * Case and hearing reads (P2, P3). Every function filters by what the role may see and returns
 * plain DTOs: client contact is never selected here, and client names only where P2 allows.
 */

export type CaseType = 'civil' | 'criminal_cr' | 'criminal_gr' | 'writ' | 'family' | 'money_loan' | 'other';

export type CaseListItem = {
  id: string;
  type: CaseType;
  number: string;
  year: string;
  court: CourtRef;
  courtNo: string | null;
  clientName: string | null;
  nextDate: Ymd | null;
};

/** Cases this person may open (P3). Staff: none — they get todayForStaff() instead. */
export function visibleCasesWhere(ctx: Ctx): Prisma.CaseWhereInput {
  const base: Prisma.CaseWhereInput = { chamberId: ctx.chamberId, deletedAt: null };
  if (ctx.role === 'owner' || ctx.role === 'munshi') return base;
  if (ctx.role === 'associate') {
    return ctx.caseScope === 'all' ? base : { ...base, assigneeMembershipId: ctx.membershipId };
  }
  return { id: { in: [] } };
}

const courtSelect = { nameBn: true, nameEn: true, level: true, district: true } as const;

export type CaseFilter = 'all' | 'today' | 'week' | 'supreme' | 'district';

export async function listCases(
  ctx: Ctx,
  opts: { q?: string; filter?: CaseFilter; clientId?: string } = {},
): Promise<CaseListItem[]> {
  if (!can.listCases(ctx)) return [];
  const today = todayInDhaka();
  const names = can.viewClientName(ctx);
  const q = opts.q?.trim();
  const and: Prisma.CaseWhereInput[] = [visibleCasesWhere(ctx), { status: 'active' }];

  if (q) {
    // Search by case number, court and (where allowed) client name. Never by contact details.
    and.push({
      OR: [
        { number: { contains: q, mode: 'insensitive' } },
        { court: { nameBn: { contains: q, mode: 'insensitive' } } },
        { court: { nameEn: { contains: q, mode: 'insensitive' } } },
        ...(names ? [{ client: { displayName: { contains: q, mode: 'insensitive' as const } } }] : []),
      ],
    });
  }
  if (opts.clientId) and.push({ clientId: opts.clientId });
  if (opts.filter === 'today') and.push({ hearings: { some: { date: dbDate(today) } } });
  if (opts.filter === 'week')
    and.push({ hearings: { some: { date: { gte: dbDate(today), lte: dbDate(addDays(today, 6)) } } } });
  if (opts.filter === 'supreme') and.push({ court: { level: 'supreme' } });
  if (opts.filter === 'district') and.push({ court: { level: { in: ['district', 'tribunal'] } } });

  const rows = await withTenant(scopeOf(ctx), (tx) =>
    tx.case.findMany({
      where: { AND: and },
      select: {
        id: true,
        type: true,
        number: true,
        year: true,
        courtNo: true,
        court: { select: courtSelect },
        client: names ? { select: { displayName: true } } : false,
        hearings: {
          where: { date: { gte: dbDate(today) } },
          orderBy: { date: 'asc' },
          take: 1,
          select: { date: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  );

  const items = rows.map((r) => ({
    id: r.id,
    type: r.type,
    number: r.number,
    year: r.year,
    court: r.court,
    courtNo: r.courtNo,
    clientName: names ? (r.client?.displayName ?? null) : null,
    nextDate: r.hearings[0] ? ymdFromDb(r.hearings[0].date) : null,
  }));
  // Soonest date first; cases without a date at the end.
  return items.sort((a, b) => (a.nextDate ?? '9999').localeCompare(b.nextDate ?? '9999'));
}

export type CaseDetail = CaseListItem & {
  ourSide: 'plaintiff' | 'defendant';
  partiesText: string | null;
  opposingCounsel: string | null;
  note: string | null;
  officialUrl: string | null;
  clientId: string | null;
  assignee: { membershipId: string; name: string | null } | null;
  nextHearing: { date: Ymd; purpose: string | null; serial: string | null } | null;
  timeline: {
    id: string;
    date: Ymd;
    purpose: string | null;
    outcomeNote: string | null;
    addedByName: string | null;
    byYou: boolean;
  }[];
  canAddHearing: boolean;
};

export async function getCase(ctx: Ctx, id: string): Promise<CaseDetail | null> {
  if (!can.listCases(ctx)) return null;
  const today = todayInDhaka();
  const names = can.viewClientName(ctx);

  return withTenant(scopeOf(ctx), async (tx) => {
    const row = await tx.case.findFirst({
      where: { AND: [visibleCasesWhere(ctx), { id }] },
      select: {
        id: true,
        type: true,
        number: true,
        year: true,
        courtNo: true,
        ourSide: true,
        partiesText: true,
        opposingCounsel: true,
        note: true,
        clientId: true,
        assigneeMembershipId: true,
        court: { select: { ...courtSelect, officialUrl: true } },
        client: names ? { select: { displayName: true } } : false,
        hearings: { orderBy: { date: 'desc' }, take: 100 },
      },
    });
    if (!row || !can.viewCase(ctx, { assigneeMembershipId: row.assigneeMembershipId })) return null;

    const memberIds = [
      ...new Set([row.assigneeMembershipId, ...row.hearings.map((h) => h.addedBy)].filter(Boolean)),
    ] as string[];
    const members = await tx.membership.findMany({
      where: { chamberId: ctx.chamberId, OR: [{ id: { in: memberIds } }, { userId: { in: memberIds } }] },
      select: { id: true, userId: true, user: { select: { name: true } } },
    });
    const nameOf = (id: string | null) => members.find((m) => m.id === id || m.userId === id)?.user.name ?? null;

    const upcoming = [...row.hearings].reverse().find((h) => ymdFromDb(h.date) >= today) ?? null;
    return {
      id: row.id,
      type: row.type,
      number: row.number,
      year: row.year,
      court: {
        nameBn: row.court.nameBn,
        nameEn: row.court.nameEn,
        level: row.court.level,
        district: row.court.district,
      },
      courtNo: row.courtNo,
      clientName: names ? (row.client?.displayName ?? null) : null,
      clientId: names ? row.clientId : null,
      nextDate: upcoming ? ymdFromDb(upcoming.date) : null,
      ourSide: row.ourSide,
      partiesText: row.partiesText,
      opposingCounsel: row.opposingCounsel,
      note: row.note,
      officialUrl: row.court.officialUrl,
      assignee: row.assigneeMembershipId
        ? { membershipId: row.assigneeMembershipId, name: nameOf(row.assigneeMembershipId) }
        : null,
      nextHearing: upcoming
        ? { date: ymdFromDb(upcoming.date), purpose: upcoming.purpose, serial: upcoming.serialOrItem }
        : null,
      timeline: row.hearings
        .filter((h) => ymdFromDb(h.date) < today || h.outcomeNote)
        .map((h) => {
          // Credit whoever wrote what happened; otherwise whoever added the date.
          const by = (h.outcomeNote && h.outcomeBy) || h.addedBy;
          return {
            id: h.id,
            date: ymdFromDb(h.date),
            purpose: h.purpose,
            outcomeNote: h.outcomeNote,
            addedByName: nameOf(by),
            byYou: by === ctx.userId,
          };
        }),
      canAddHearing: can.addHearing(ctx, { assigneeMembershipId: row.assigneeMembershipId }),
    };
  });
}

export type TodayHearing = {
  hearingId: string;
  caseId: string;
  type: CaseType;
  number: string;
  year: string;
  court: CourtRef;
  courtNo: string | null;
  serial: string | null;
  ourSide: 'plaintiff' | 'defendant';
  clientName: string | null;
  assigneeName: string | null;
  canAddHearing: boolean;
};

/** Hearings on a date for the cases this person may see (owner, associate, munshi). */
export async function hearingsOn(ctx: Ctx, date: Ymd): Promise<TodayHearing[]> {
  if (!can.listCases(ctx)) return [];
  const names = can.viewClientName(ctx);
  return withTenant(scopeOf(ctx), async (tx) => {
    const rows = await tx.hearing.findMany({
      where: { chamberId: ctx.chamberId, date: dbDate(date), case: visibleCasesWhere(ctx) },
      select: {
        id: true,
        serialOrItem: true,
        case: {
          select: {
            id: true,
            type: true,
            number: true,
            year: true,
            courtNo: true,
            ourSide: true,
            assigneeMembershipId: true,
            court: { select: courtSelect },
            client: names ? { select: { displayName: true } } : false,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const assigneeIds = [...new Set(rows.map((r) => r.case.assigneeMembershipId).filter(Boolean))] as string[];
    const members = await tx.membership.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, user: { select: { name: true } } },
    });
    return rows.map((r) => ({
      hearingId: r.id,
      caseId: r.case.id,
      type: r.case.type,
      number: r.case.number,
      year: r.case.year,
      court: r.case.court,
      courtNo: r.case.courtNo,
      serial: r.serialOrItem,
      ourSide: r.case.ourSide,
      clientName: names ? (r.case.client?.displayName ?? null) : null,
      assigneeName: members.find((m) => m.id === r.case.assigneeMembershipId)?.user.name ?? null,
      canAddHearing: can.addHearing(ctx, { assigneeMembershipId: r.case.assigneeMembershipId }),
    }));
  });
}

export async function countHearingsOn(ctx: Ctx, date: Ymd): Promise<number> {
  if (!can.listCases(ctx)) return 0;
  return withTenant(scopeOf(ctx), (tx) =>
    tx.hearing.count({ where: { chamberId: ctx.chamberId, date: dbDate(date), case: visibleCasesWhere(ctx) } }),
  );
}

/**
 * Office staff's today list (P3): case number, court and serial only.
 * Deliberately selects no client and no assignee, so nothing else can leak into the page.
 */
export type StaffTodayItem = {
  type: CaseType;
  number: string;
  year: string;
  court: CourtRef;
  courtNo: string | null;
  serial: string | null;
};

export async function todayForStaff(ctx: Ctx): Promise<StaffTodayItem[]> {
  const today = todayInDhaka();
  const rows = await withTenant(scopeOf(ctx), (tx) =>
    tx.hearing.findMany({
      where: { chamberId: ctx.chamberId, date: dbDate(today), case: { deletedAt: null, status: 'active' } },
      select: {
        serialOrItem: true,
        case: { select: { type: true, number: true, year: true, courtNo: true, court: { select: courtSelect } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  );
  return rows.map((r) => ({ ...r.case, serial: r.serialOrItem }));
}

/** Number of hearings per day of a month, for the calendar (F3). */
export async function hearingCountsInMonth(ctx: Ctx, year: number, month: number): Promise<Record<Ymd, number>> {
  if (!can.listCases(ctx)) return {};
  const from = dbDate(`${year}-${String(month).padStart(2, '0')}-01`);
  const to = new Date(Date.UTC(year, month, 1));
  const rows = await withTenant(scopeOf(ctx), (tx) =>
    tx.hearing.findMany({
      where: { chamberId: ctx.chamberId, date: { gte: from, lt: to }, case: visibleCasesWhere(ctx) },
      select: { date: true },
    }),
  );
  const counts: Record<Ymd, number> = {};
  for (const r of rows) counts[ymdFromDb(r.date)] = (counts[ymdFromDb(r.date)] ?? 0) + 1;
  return counts;
}

export type CourtOption = { id: string; label: CourtRef; supreme: boolean };

const DIRECTORY_ORDER = [
  'Appellate Division',
  'High Court Division',
  'District and Sessions Judge Court',
  'Additional District and Sessions Judge Court',
  'Joint District Judge Court',
  'Senior Assistant Judge Court',
  'Assistant Judge Court',
  'Chief Judicial Magistrate Court',
  'Chief Metropolitan Magistrate Court',
  'Family Court',
  'Artha Rin Adalat (Money Loan Court)',
  'Nari o Shishu Nirjatan Daman Tribunal',
];

/** Courts to pick from: the Supreme Court, the chamber's district, and the chamber's own courts. */
export async function courtOptions(ctx: Ctx): Promise<CourtOption[]> {
  return withTenant(scopeOf(ctx), async (tx) => {
    const chamber = await tx.chamber.findUniqueOrThrow({ where: { id: ctx.chamberId }, select: { district: true } });
    const courts = await tx.court.findMany({
      where: { OR: [{ level: 'supreme' }, { district: chamber.district }, { chamberId: ctx.chamberId }] },
      select: { id: true, ...courtSelect },
    });
    // Seed order is the directory order (district courts by seniority); keep it stable by name within a level.
    const rank = (c: (typeof courts)[number]) => DIRECTORY_ORDER.indexOf(c.nameEn) + 1 || 99;
    courts.sort((a, b) => rank(a) - rank(b) || a.nameBn.localeCompare(b.nameBn));
    return courts.map((c) => ({ id: c.id, label: c, supreme: c.level === 'supreme' }));
  });
}

/** Owner and associates a case can be assigned to (owner only picks). */
export async function assigneeOptions(ctx: Ctx) {
  if (!can.assignCase(ctx)) return [];
  return withTenant(scopeOf(ctx), (tx) =>
    tx.membership.findMany({
      where: { chamberId: ctx.chamberId, status: 'active', role: { in: ['owner', 'associate'] } },
      select: { id: true, role: true, userId: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  );
}
