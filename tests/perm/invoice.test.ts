import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Ctx } from '@/server/authz';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/** F32: the case invoice follows the money rule (P9) and the case's visibility, and carries no client contact (P1). */
vi.mock('@/server/context', () => ({ requireCtx: async () => null, getCtx: async () => null }));

let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;
const caseId = randomUUID();
const otherCaseId = randomUUID();

type Role = 'owner' | 'associate' | 'munshi';
const ctxOf = (role: Role, opts: { canSeeFees?: boolean; scope?: 'all' | 'assigned' } = {}): Ctx => {
  const m = seed.a.members[role];
  return {
    userId: m.userId,
    chamberId: seed.a.chamberId,
    membershipId: m.membershipId,
    role,
    caseScope: opts.scope ?? 'assigned',
    canSeeFees: opts.canSeeFees ?? false,
  };
};
const setFees = (role: Role, on: boolean) =>
  root.query(`UPDATE memberships SET can_see_fees = $1 WHERE id = $2`, [on, seed.a.members[role].membershipId]);
const invoice = async (ctx: Ctx, id = caseId) => (await import('@/features/money/queries')).invoiceData(ctx, id);

beforeAll(async () => {
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  await root.connect();
  const court = (await root.query(`SELECT id FROM courts WHERE chamber_id IS NULL LIMIT 1`)).rows[0].id;
  const clientId = randomUUID();
  const owner = seed.a.members.owner;
  await root.query(
    `INSERT INTO clients (id, chamber_id, display_name, created_by, updated_at) VALUES ($1, $2, 'Rahima Khatun', $3, now())`,
    [clientId, seed.a.chamberId, owner.userId],
  );
  for (const [id, assignee] of [
    [caseId, seed.a.members.associate.membershipId],
    [otherCaseId, owner.membershipId],
  ]) {
    await root.query(
      `INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, client_id, assignee_membership_id, created_by, updated_at)
       VALUES ($1, $2, 'civil', '77', '2026', $3, 'plaintiff', $4, $5, $6, now())`,
      [id, seed.a.chamberId, court, clientId, assignee, owner.userId],
    );
  }
  for (const [desc, amount, on] of [
    ['Drafting fee', 500000, '2026-09-01'],
    ['Hearing fee', 200000, '2026-10-01'],
  ] as const) {
    await root.query(
      `INSERT INTO fees (id, chamber_id, case_id, description, amount_poisha, charged_on, created_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [randomUUID(), seed.a.chamberId, caseId, desc, amount, on, owner.userId],
    );
  }
  await root.query(
    `INSERT INTO fees (id, chamber_id, case_id, description, amount_poisha, charged_on, created_by, deleted_at, updated_at)
     VALUES ($1, $2, $3, 'Removed fee', 999900, '2026-09-02', $4, now(), now())`,
    [randomUUID(), seed.a.chamberId, caseId, owner.userId],
  );
  await root.query(
    `INSERT INTO payments (id, chamber_id, case_id, client_id, amount_poisha, method, description, paid_on, receipt_no, received_by)
     VALUES ($1, $2, $3, $4, 300000, 'bkash', 'Advance', '2026-09-05', 901, $5)`,
    [randomUUID(), seed.a.chamberId, caseId, clientId, owner.userId],
  );
});
afterAll(async () => {
  await root?.end();
});

describe('case invoice (F32)', () => {
  it('owner gets every live fee, the payments and the balance', async () => {
    const inv = await invoice(ctxOf('owner'));
    expect(inv).not.toBeNull();
    expect(inv!.fees.map((f) => f.description).sort()).toEqual(['Drafting fee', 'Hearing fee']);
    expect(inv!.chargedPoisha).toBe(700000);
    expect(inv!.paidPoisha).toBe(300000);
    expect(inv!.duePoisha).toBe(400000);
    expect(inv!.payments.map((p) => p.receiptNo)).toEqual([901]);
    expect(inv!.clientName).toBe('Rahima Khatun');
  });

  it('carries no client contact (P1)', async () => {
    const json = JSON.stringify(await invoice(ctxOf('owner')));
    expect(json).not.toMatch(/contact|phone|email|nid/i);
  });

  it('associate gets it only when the owner turned fees on, and only for cases they can open', async () => {
    expect(await invoice(ctxOf('associate'))).toBeNull();
    await setFees('associate', true);
    try {
      expect(await invoice(ctxOf('associate', { canSeeFees: true }))).not.toBeNull();
      expect(await invoice(ctxOf('associate', { canSeeFees: true }), otherCaseId)).toBeNull();
    } finally {
      await setFees('associate', false);
    }
  });

  it('munshi never gets it, whatever the flag says', async () => {
    await setFees('munshi', true);
    try {
      expect(await invoice(ctxOf('munshi', { canSeeFees: true, scope: 'all' }))).toBeNull();
    } finally {
      await setFees('munshi', false);
    }
  });

  it("another chamber's owner gets nothing", async () => {
    const b = seed.b.members.owner;
    const ctx: Ctx = {
      userId: b.userId,
      chamberId: seed.b.chamberId,
      membershipId: b.membershipId,
      role: 'owner',
      caseScope: 'all',
      canSeeFees: false,
    };
    expect(await invoice(ctx)).toBeNull();
  });
});
