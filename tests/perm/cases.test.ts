import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dbDate, todayInDhaka } from '@/lib/dates';
import type { Ctx, Role } from '@/server/authz';
import { prisma } from '@/server/db/client';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { getCase, hearingsOn, listCases, todayForStaff } from '@/features/cases/queries';
import { readClientContact, writeClientContact } from '@/features/clients/contact';
import { getClient, listClients } from '@/features/clients/queries';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/** M2 acceptance: P1–P4 at the data layer. Associate data never contains contact; staff never get client names. */
let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let ctx: Record<Role, Ctx>;
let assignedCaseId: string;
let otherCaseId: string;
let clientId: string;
const PHONE = '+8801812345678';
const CLIENT = 'Karim Hossain';

beforeAll(async () => {
  seed = await seedTwoChambers();
  const { a } = seed;
  const make = (role: Role): Ctx => ({
    userId: a.members[role].userId,
    chamberId: a.chamberId,
    membershipId: a.members[role].membershipId,
    role,
    caseScope: role === 'associate' ? 'assigned' : 'all',
    canSeeFees: false,
  });
  ctx = { owner: make('owner'), associate: make('associate'), munshi: make('munshi'), staff: make('staff') };

  const today = todayInDhaka();
  await withTenant(scopeOf(ctx.owner), async (tx) => {
    const court = await tx.court.findFirstOrThrow({
      where: { district: 'Chattogram', nameEn: 'Joint District Judge Court' },
    });
    const client = await tx.client.create({
      data: { chamberId: a.chamberId, displayName: CLIENT, createdBy: ctx.owner.userId },
    });
    clientId = client.id;
    const base = {
      chamberId: a.chamberId,
      type: 'civil' as const,
      year: '2026',
      courtId: court.id,
      ourSide: 'plaintiff' as const,
      clientId,
      createdBy: ctx.owner.userId,
    };
    assignedCaseId = (
      await tx.case.create({ data: { ...base, number: '245', assigneeMembershipId: ctx.associate.membershipId } })
    ).id;
    otherCaseId = (
      await tx.case.create({ data: { ...base, number: '310', assigneeMembershipId: ctx.owner.membershipId } })
    ).id;
    for (const caseId of [assignedCaseId, otherCaseId]) {
      await tx.hearing.create({
        data: { chamberId: a.chamberId, caseId, date: dbDate(today), serialOrItem: '12', addedBy: ctx.owner.userId },
      });
    }
  });
  await writeClientContact(ctx.owner, clientId, {
    phone: PHONE,
    email: 'karim@example.com',
    nid: '1234567890',
    address: 'Khulshi',
    consent: true,
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const contactWords = /phone|email|nid|address|8801812345678|karim@example|Khulshi|1234567890/i;

describe('P1 client contact', () => {
  it('is stored encrypted, never as plain text', async () => {
    const db = new pg.Client({ connectionString: testDb.migrateUrl });
    await db.connect();
    const { rows } = await db.query('SELECT * FROM client_contacts WHERE client_id = $1', [clientId]);
    await db.end();
    expect(JSON.stringify(rows)).not.toMatch(/8801812345678|karim@example|Khulshi|1234567890/);
  });

  it('the owner can read it, and each read is audited', async () => {
    const contact = await readClientContact(ctx.owner, clientId);
    expect(contact?.phone).toBe(PHONE);
    const views = await withTenant(scopeOf(ctx.owner), (tx) =>
      tx.auditLog.count({ where: { action: 'client_contact.view', entityId: clientId } }),
    );
    expect(views).toBeGreaterThan(0);
  });

  it.each(['associate', 'munshi', 'staff'] as const)('%s cannot read it through the app', async (role) => {
    await expect(readClientContact(ctx[role], clientId)).rejects.toThrow(/Forbidden/);
  });

  it.each(['associate', 'munshi', 'staff'] as const)(
    '%s cannot read it even with a direct query (database lock)',
    async (role) => {
      const rows = await withTenant(scopeOf(ctx[role]), (tx) => tx.clientContact.findMany());
      expect(rows).toEqual([]);
    },
  );

  it('an associate cannot write contact rows directly either', async () => {
    await expect(
      withTenant(scopeOf(ctx.associate), (tx) =>
        tx.clientContact.update({ where: { clientId }, data: { phoneEnc: null } }),
      ),
    ).rejects.toThrow();
  });

  it.each(['associate', 'munshi'] as const)('%s never receives contact in any case or client data', async (role) => {
    const payload = JSON.stringify({
      list: await listCases(ctx[role]),
      detail: await getCase(ctx[role], assignedCaseId),
      today: await hearingsOn(ctx[role], todayInDhaka()),
      clients: await listClients(ctx[role]),
      client: await getClient(ctx[role], clientId),
    });
    expect(payload).not.toMatch(contactWords);
    expect(payload).toContain(CLIENT); // P2: they do see the name
  });
});

describe('P2 and P3: staff see only case number, court and serial', () => {
  it('staff get no case list, no case detail, no clients', async () => {
    expect(await listCases(ctx.staff)).toEqual([]);
    expect(await getCase(ctx.staff, assignedCaseId)).toBeNull();
    expect(await listClients(ctx.staff)).toEqual([]);
    expect(await getClient(ctx.staff, clientId)).toBeNull();
    expect(await hearingsOn(ctx.staff, todayInDhaka())).toEqual([]);
  });

  it("staff's today list has no client name or contact", async () => {
    const items = await todayForStaff(ctx.staff);
    expect(items).toHaveLength(2);
    expect(Object.keys(items[0]).sort()).toEqual(['court', 'courtNo', 'number', 'serial', 'type', 'year']);
    expect(JSON.stringify(items)).not.toContain(CLIENT);
    expect(JSON.stringify(items)).not.toMatch(contactWords);
  });
});

describe('P3 associate case scope', () => {
  it('an associate sees only assigned cases', async () => {
    expect((await listCases(ctx.associate)).map((c) => c.id)).toEqual([assignedCaseId]);
    expect(await getCase(ctx.associate, otherCaseId)).toBeNull();
    expect((await hearingsOn(ctx.associate, todayInDhaka())).map((h) => h.caseId)).toEqual([assignedCaseId]);
  });

  it('when the owner allows all cases, the associate sees all', async () => {
    const all = { ...ctx.associate, caseScope: 'all' as const };
    expect((await listCases(all)).map((c) => c.id).sort()).toEqual([assignedCaseId, otherCaseId].sort());
  });

  it('owner and munshi see every case', async () => {
    expect(await listCases(ctx.owner)).toHaveLength(2);
    expect(await listCases(ctx.munshi)).toHaveLength(2);
  });
});

describe('P4 add next date', () => {
  it('reports who may add a date on each case', async () => {
    expect((await getCase(ctx.owner, otherCaseId))?.canAddHearing).toBe(true);
    expect((await getCase(ctx.munshi, otherCaseId))?.canAddHearing).toBe(true);
    expect((await getCase(ctx.associate, assignedCaseId))?.canAddHearing).toBe(true);
  });
});

describe('tenant isolation for cases and clients', () => {
  it("chamber B's owner sees none of chamber A's cases, clients or hearings", async () => {
    const { b } = seed;
    const ownerB: Ctx = {
      userId: b.members.owner.userId,
      chamberId: b.chamberId,
      membershipId: b.members.owner.membershipId,
      role: 'owner',
      caseScope: 'all',
      canSeeFees: false,
    };
    expect(await listCases(ownerB)).toEqual([]);
    expect(await getCase(ownerB, assignedCaseId)).toBeNull();
    expect(await getClient(ownerB, clientId)).toBeNull();
    await expect(readClientContact(ownerB, clientId)).resolves.toBeNull();
  });

  it('a hearing cannot point to another chamber’s case', async () => {
    const { b } = seed;
    await expect(
      withTenant({ chamberId: b.chamberId, role: 'owner' }, (tx) =>
        tx.hearing.create({
          data: {
            chamberId: b.chamberId,
            caseId: assignedCaseId,
            date: dbDate(todayInDhaka()),
            addedBy: b.members.owner.userId,
          },
        }),
      ),
    ).rejects.toThrow();
  });
});
