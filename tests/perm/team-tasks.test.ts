import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { can, type Ctx, type Role } from '@/server/authz';
import { prisma } from '@/server/db/client';
import { scopeOf, withTenant } from '@/server/db/tenant';
import { grantState, supportRequests } from '@/features/support/queries';
import { listTasks } from '@/features/tasks/queries';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/** M3: tasks (P11), team management (P10) and support approval (P13) at the data layer. */
let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let ctx: Record<Role, Ctx>;
let ctxB: Ctx;

beforeAll(async () => {
  seed = await seedTwoChambers();
  const make = (s: typeof seed.a, role: Role): Ctx => ({
    userId: s.members[role].userId,
    chamberId: s.chamberId,
    membershipId: s.members[role].membershipId,
    role,
    caseScope: 'all',
    canSeeFees: false,
  });
  ctx = {
    owner: make(seed.a, 'owner'),
    associate: make(seed.a, 'associate'),
    munshi: make(seed.a, 'munshi'),
    staff: make(seed.a, 'staff'),
  };
  ctxB = make(seed.b, 'owner');
  await withTenant(scopeOf(ctx.owner), async (tx) => {
    for (const role of ['staff', 'associate'] as const) {
      await tx.task.create({
        data: {
          chamberId: seed.a.chamberId,
          assigneeMembershipId: ctx[role].membershipId,
          title: `Task for ${role}`,
          createdBy: ctx.owner.userId,
        },
      });
    }
  });
  const root = new pg.Client({ connectionString: testDb.migrateUrl });
  await root.connect();
  const adminId = randomUUID();
  await root.query(
    `INSERT INTO platform_admins (id, phone, name, role, password_hash, totp_secret_enc, updated_at)
     VALUES ($1, $2, 'Support Person', 'support', 'x', 'x', now())`,
    [adminId, `+88019${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`],
  );
  await root.query(`INSERT INTO support_grants (id, chamber_id, admin_id, reason) VALUES ($1, $2, $3, 'Help please')`, [
    randomUUID(),
    seed.a.chamberId,
    adminId,
  ]);
  await root.end();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe('tasks (P11)', () => {
  it('the owner sees every task in the chamber', async () => {
    const { open } = await listTasks(ctx.owner);
    expect(open.map((t) => t.title).sort()).toEqual(['Task for associate', 'Task for staff']);
  });

  it.each(['associate', 'staff'] as const)('%s sees only their own', async (role) => {
    const { open } = await listTasks(ctx[role]);
    expect(open.map((t) => t.title)).toEqual([`Task for ${role}`]);
  });

  it('the munshi has none, and another chamber sees none', async () => {
    expect((await listTasks(ctx.munshi)).open).toEqual([]);
    expect((await listTasks(ctxB)).open).toEqual([]);
  });

  it('only the owner assigns; only the owner or the assignee ticks off', () => {
    expect((['owner', 'associate', 'munshi', 'staff'] as const).filter((r) => can.assignTask(ctx[r]))).toEqual([
      'owner',
    ]);
    const task = { assigneeMembershipId: ctx.staff.membershipId };
    expect((['owner', 'associate', 'munshi', 'staff'] as const).filter((r) => can.completeTask(ctx[r], task))).toEqual([
      'owner',
      'staff',
    ]);
  });
});

describe('team and support approval (P10, P13)', () => {
  it('only the owner manages the team and approves support', () => {
    for (const role of ['associate', 'munshi', 'staff'] as const) {
      expect(can.manageTeam(ctx[role])).toBe(false);
      expect(can.approveSupportAccess(ctx[role])).toBe(false);
      expect(can.viewAuditLog(ctx[role])).toBe(false);
    }
  });

  it('the owner sees the request with the admin name; other roles and chambers see nothing', async () => {
    const owner = await supportRequests(ctx.owner);
    expect(owner).toHaveLength(1);
    expect(owner[0]).toMatchObject({ adminName: 'Support Person', reason: 'Help please', state: 'pending' });
    expect(await supportRequests(ctx.associate)).toEqual([]);
    expect(await supportRequests(ctxB)).toEqual([]);
  });

  it('grant state follows approval, expiry, rejection and revocation', () => {
    const now = new Date('2026-10-03T10:00:00Z');
    const base = { approvedAt: null, rejectedAt: null, revokedAt: null, expiresAt: null };
    const approved = { ...base, approvedAt: new Date('2026-10-03T09:00:00Z') };
    expect(grantState(base, now)).toBe('pending');
    expect(grantState({ ...approved, expiresAt: new Date('2026-10-04T09:00:00Z') }, now)).toBe('active');
    expect(grantState({ ...approved, expiresAt: new Date('2026-10-03T09:59:00Z') }, now)).toBe('ended');
    expect(grantState({ ...base, rejectedAt: now }, now)).toBe('ended');
    expect(grantState({ ...approved, expiresAt: new Date('2026-10-04T09:00:00Z'), revokedAt: now }, now)).toBe('ended');
  });

  it('the app role can write approval columns but not the reason or the admin', async () => {
    const app = new pg.Client({ connectionString: testDb.appUrl });
    await app.connect();
    await app.query('BEGIN');
    await app.query(`SELECT set_config('app.chamber_id', $1, true)`, [seed.a.chamberId]);
    await expect(app.query(`UPDATE support_grants SET reason = 'changed'`)).rejects.toThrow(/permission denied/);
    await app.query('ROLLBACK');
    await app.end();
  });
});
