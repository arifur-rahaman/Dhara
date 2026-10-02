import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { audit } from '@/server/audit';
import { prisma } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/**
 * Tenant isolation at the database level (plan.md M1 acceptance: two chambers cannot see each other's data).
 * Every query here runs as the app role, the same connection the app uses.
 */
let seed: Awaited<ReturnType<typeof seedTwoChambers>>;

beforeAll(async () => {
  seed = await seedTwoChambers();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('row-level security', () => {
  it('the app role is not a superuser, does not own tables and cannot bypass RLS', async () => {
    const db = new pg.Client({ connectionString: testDb.appUrl });
    await db.connect();
    const { rows } = await db.query(
      `SELECT r.rolsuper, r.rolbypassrls,
              (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user) AS owned
         FROM pg_roles r WHERE r.rolname = current_user`,
    );
    await db.end();
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, owned: '0' });
  });

  it('without a chamber context, no tenant rows are visible', async () => {
    const [chambers, memberships, invitations, audit] = await withTenant({}, (tx) =>
      Promise.all([tx.chamber.count(), tx.membership.count(), tx.invitation.count(), tx.auditLog.count()]),
    );
    expect({ chambers, memberships, invitations, audit }).toEqual({
      chambers: 0,
      memberships: 0,
      invitations: 0,
      audit: 0,
    });
  });

  it('chamber A sees only its own chamber, members, invitations and audit log', async () => {
    const { a, b } = seed;
    const rows = await withTenant({ chamberId: a.chamberId }, async (tx) => ({
      chambers: await tx.chamber.findMany({ select: { id: true } }),
      memberships: await tx.membership.findMany({ select: { chamberId: true } }),
      invitations: await tx.invitation.findMany({ select: { chamberId: true } }),
      audit: await tx.auditLog.findMany({ select: { chamberId: true } }),
      chamberB: await tx.chamber.findUnique({ where: { id: b.chamberId } }),
    }));
    expect(rows.chambers.map((c) => c.id)).toEqual([a.chamberId]);
    expect(new Set(rows.memberships.map((m) => m.chamberId))).toEqual(new Set([a.chamberId]));
    expect(rows.memberships).toHaveLength(4);
    expect(rows.invitations.every((i) => i.chamberId === a.chamberId)).toBe(true);
    expect(rows.audit.every((e) => e.chamberId === a.chamberId)).toBe(true);
    expect(rows.chamberB).toBeNull();
  });

  it('cannot write rows into another chamber', async () => {
    const { a, b } = seed;
    await expect(
      withTenant({ chamberId: a.chamberId }, (tx) =>
        tx.invitation.create({
          data: {
            chamberId: b.chamberId,
            phone: '+8801911111111',
            name: 'x',
            role: 'staff',
            tokenHash: `cross-${Date.now()}`,
            invitedBy: a.members.owner.userId,
            expiresAt: new Date(Date.now() + 1000),
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('cannot update or read memberships of another chamber', async () => {
    const { a, b } = seed;
    const updated = await withTenant({ chamberId: a.chamberId }, (tx) =>
      tx.membership.updateMany({ where: { chamberId: b.chamberId }, data: { role: 'owner' } }),
    );
    expect(updated.count).toBe(0);
  });

  it("a user sees their own memberships across chambers, but not other people's", async () => {
    const { a } = seed;
    const rows = await withTenant({ userId: a.members.munshi.userId }, (tx) => tx.membership.findMany());
    expect(rows.map((m) => m.userId)).toEqual([a.members.munshi.userId]);
  });

  it('an invitation token reveals only that invitation and its chamber', async () => {
    const { a, b } = seed;
    const rows = await withTenant({ inviteTokenHash: b.inviteTokenHash }, async (tx) => ({
      invitations: await tx.invitation.findMany({ select: { id: true } }),
      chambers: await tx.chamber.findMany({ select: { id: true } }),
    }));
    expect(rows.invitations.map((i) => i.id)).toEqual([b.inviteId]);
    expect(rows.chambers.map((c) => c.id)).toEqual([b.chamberId]);
    expect(rows.chambers.map((c) => c.id)).not.toContain(a.chamberId);
  });

  it('the audit log is append-only for the app role', async () => {
    const { a } = seed;
    await expect(
      withTenant({ chamberId: a.chamberId }, (tx) => tx.auditLog.updateMany({ data: { action: 'tampered' } })),
    ).rejects.toThrow(/permission denied/);
    await expect(withTenant({ chamberId: a.chamberId }, (tx) => tx.auditLog.deleteMany())).rejects.toThrow(
      /permission denied/,
    );
  });

  it('records sign-in events without a chamber, which the app can then not read back', async () => {
    const { a } = seed;
    await withTenant({}, (tx) =>
      audit(tx, { chamberId: null, actorUserId: a.members.owner.userId, action: 'auth.sign_in', entity: 'user' }),
    );
    const visible = await withTenant({ chamberId: a.chamberId }, (tx) =>
      tx.auditLog.count({ where: { action: 'auth.sign_in' } }),
    );
    expect(visible).toBe(0);
  });

  it('cannot record an audit event for another chamber', async () => {
    const { a, b } = seed;
    await expect(
      withTenant({ chamberId: a.chamberId }, (tx) =>
        audit(tx, {
          chamberId: b.chamberId,
          actorUserId: a.members.owner.userId,
          action: 'chamber.create',
          entity: 'chamber',
        }),
      ),
    ).rejects.toThrow();
  });

  it('the admin portal role has no access to chamber tables', async () => {
    const db = new pg.Client({ connectionString: testDb.adminUrl });
    await db.connect();
    for (const table of ['chambers', 'memberships', 'invitations', 'audit_log', 'users']) {
      await expect(db.query(`SELECT 1 FROM ${table} LIMIT 1`), table).rejects.toThrow(/permission denied/);
    }
    await db.end();
  });

  it('context does not leak between transactions on the same pool', async () => {
    const { a } = seed;
    await withTenant({ chamberId: a.chamberId }, (tx) => tx.chamber.count());
    const after = await withTenant({}, (tx) => tx.chamber.count());
    expect(after).toBe(0);
  });
});
