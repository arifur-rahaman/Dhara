import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/**
 * M4 at the database level: documents (P5, P6) and money (P9).
 * Each query runs as the app role with the same settings withTenant() makes.
 */
type Role = 'owner' | 'associate' | 'munshi' | 'staff';
let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;
let app: pg.Client;
let assignedCase: string;
let otherCase: string;
const docs: Record<string, string> = {};

async function as<T>(role: Role, fn: () => Promise<T>, chamber = seed.a): Promise<T> {
  await app.query('BEGIN');
  try {
    await app.query(
      `SELECT set_config('app.chamber_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', $3, true)`,
      [chamber.chamberId, chamber.members[role].userId, role],
    );
    const out = await fn();
    await app.query('COMMIT');
    return out;
  } catch (e) {
    await app.query('ROLLBACK');
    throw e;
  }
}

const visibleDocs = (role: Role) =>
  as(role, async () => (await app.query(`SELECT title FROM documents ORDER BY title`)).rows.map((r) => r.title));

beforeAll(async () => {
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  app = new pg.Client({ connectionString: testDb.appUrl });
  await Promise.all([root.connect(), app.connect()]);
  const { a } = seed;
  const court = (await root.query(`SELECT id FROM courts LIMIT 1`)).rows[0].id;
  const mkCase = async (assignee: string) => {
    const id = randomUUID();
    await root.query(
      `INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, assignee_membership_id, created_by, updated_at)
       VALUES ($1, $2, 'civil', '1', '2026', $3, 'plaintiff', $4, $5, now())`,
      [id, a.chamberId, court, assignee, a.members.owner.userId],
    );
    return id;
  };
  assignedCase = await mkCase(a.members.associate.membershipId);
  otherCase = await mkCase(a.members.owner.membershipId);
  const doc = async (title: string, caseId: string, kind: string, confidential: boolean, by: Role) => {
    const id = randomUUID();
    await root.query(
      `INSERT INTO documents (id, chamber_id, case_id, kind, title, file_name, content_type, size_bytes, storage_key, confidential, status, uploaded_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'f.pdf', 'application/pdf', 10, $6, $7, 'ready', $8, now())`,
      [id, a.chamberId, caseId, kind, title, `k/${id}`, confidential, a.members[by].userId],
    );
    docs[title] = id;
  };
  await doc('assigned-order', assignedCase, 'order', false, 'owner');
  await doc('assigned-pleading', assignedCase, 'pleading', false, 'owner');
  await doc('other-order', otherCase, 'order', false, 'owner');
  await doc('owner-secret', assignedCase, 'pleading', true, 'owner');
  await doc('associate-secret', assignedCase, 'other', true, 'associate');
  await root.query(
    `INSERT INTO fees (id, chamber_id, case_id, description, amount_poisha, charged_on, created_by, updated_at)
     VALUES ($1, $2, $3, 'Hearing fee', 1500000, current_date, $4, now())`,
    [randomUUID(), a.chamberId, assignedCase, a.members.owner.userId],
  );
  await root.query(
    `INSERT INTO payments (id, chamber_id, case_id, amount_poisha, method, description, paid_on, receipt_no, received_by)
     VALUES ($1, $2, $3, 500000, 'bkash', 'Hearing fee', current_date, 1, $4)`,
    [randomUUID(), a.chamberId, assignedCase, a.members.owner.userId],
  );
});

afterAll(async () => {
  await Promise.all([root.end(), app.end()]);
});

describe('documents (P5, P6)', () => {
  it('owner sees every document, including private ones by others', async () => {
    expect(await visibleDocs('owner')).toEqual([
      'assigned-order',
      'assigned-pleading',
      'associate-secret',
      'other-order',
      'owner-secret',
    ]);
  });

  it('associate (assigned scope) sees documents of assigned cases and their own private ones only', async () => {
    expect(await visibleDocs('associate')).toEqual(['assigned-order', 'assigned-pleading', 'associate-secret']);
  });

  it('associate with "all cases" scope sees other cases too, still not the owner\'s private document', async () => {
    await root.query(`UPDATE memberships SET case_scope = 'all' WHERE id = $1`, [
      seed.a.members.associate.membershipId,
    ]);
    expect(await visibleDocs('associate')).toEqual([
      'assigned-order',
      'assigned-pleading',
      'associate-secret',
      'other-order',
    ]);
    await root.query(`UPDATE memberships SET case_scope = 'assigned' WHERE id = $1`, [
      seed.a.members.associate.membershipId,
    ]);
  });

  it('munshi sees orders only; staff see nothing', async () => {
    expect(await visibleDocs('munshi')).toEqual(['assigned-order', 'other-order']);
    expect(await visibleDocs('staff')).toEqual([]);
  });

  it('another chamber sees nothing', async () => {
    expect(await as('owner', async () => (await app.query(`SELECT 1 FROM documents`)).rowCount, seed.b)).toBe(0);
  });

  it('a revoked member sees nothing even with a stale role setting', async () => {
    await root.query(`UPDATE memberships SET status = 'revoked' WHERE id = $1`, [seed.a.members.munshi.membershipId]);
    expect(await visibleDocs('munshi')).toEqual([]);
    await root.query(`UPDATE memberships SET status = 'active' WHERE id = $1`, [seed.a.members.munshi.membershipId]);
  });

  it('munshi can upload an order but not a pleading; staff cannot upload', async () => {
    const insert = (role: Role, kind: string) =>
      as(role, () =>
        app.query(
          `INSERT INTO documents (id, chamber_id, case_id, kind, title, file_name, content_type, size_bytes, storage_key, uploaded_by, updated_at)
           VALUES ($1, $2, $3, $4, 't', 'f.jpg', 'image/jpeg', 5, $5, $6, now())`,
          [randomUUID(), seed.a.chamberId, otherCase, kind, `k/${randomUUID()}`, seed.a.members[role].userId],
        ),
      );
    await expect(insert('munshi', 'order')).resolves.toBeTruthy();
    await expect(insert('munshi', 'pleading')).rejects.toThrow(/row-level security/);
    await expect(insert('staff', 'order')).rejects.toThrow(/row-level security/);
  });

  it("nobody can upload in another person's name", async () => {
    await expect(
      as('associate', () =>
        app.query(
          `INSERT INTO documents (id, chamber_id, case_id, kind, title, file_name, content_type, size_bytes, storage_key, uploaded_by, updated_at)
           VALUES ($1, $2, $3, 'other', 't', 'f.pdf', 'application/pdf', 5, $4, $5, now())`,
          [randomUUID(), seed.a.chamberId, assignedCase, `k/${randomUUID()}`, seed.a.members.owner.userId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("an associate cannot change the owner's documents, nor the storage key of any", async () => {
    const r = await as('associate', () =>
      app.query(`UPDATE documents SET title = 'x' WHERE id = $1`, [docs['assigned-order']]),
    );
    expect(r.rowCount).toBe(0);
    await expect(as('owner', () => app.query(`UPDATE documents SET storage_key = 'x'`))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('fees and payments (P9)', () => {
  const counts = (role: Role) =>
    as(role, async () => ({
      fees: (await app.query(`SELECT 1 FROM fees`)).rowCount,
      payments: (await app.query(`SELECT 1 FROM payments`)).rowCount,
    }));

  it('owner sees fees and payments', async () => {
    expect(await counts('owner')).toEqual({ fees: 1, payments: 1 });
  });

  it('associate sees them only when the owner turns fees on', async () => {
    expect(await counts('associate')).toEqual({ fees: 0, payments: 0 });
    await root.query(`UPDATE memberships SET can_see_fees = true WHERE id = $1`, [
      seed.a.members.associate.membershipId,
    ]);
    expect(await counts('associate')).toEqual({ fees: 1, payments: 1 });
    await root.query(`UPDATE memberships SET can_see_fees = false WHERE id = $1`, [
      seed.a.members.associate.membershipId,
    ]);
  });

  it('munshi and staff never see money, whatever their flag says', async () => {
    await root.query(`UPDATE memberships SET can_see_fees = true WHERE id = $1`, [seed.a.members.munshi.membershipId]);
    expect(await counts('munshi')).toEqual({ fees: 0, payments: 0 });
    expect(await counts('staff')).toEqual({ fees: 0, payments: 0 });
  });

  it('only the owner records payments; receipts cannot be edited or deleted', async () => {
    const pay = (role: Role, receipt: number) =>
      as(role, () =>
        app.query(
          `INSERT INTO payments (id, chamber_id, case_id, amount_poisha, method, description, paid_on, receipt_no, received_by)
           VALUES ($1, $2, $3, 100, 'cash', 'x', current_date, $4, $5)`,
          [randomUUID(), seed.a.chamberId, assignedCase, receipt, seed.a.members[role].userId],
        ),
      );
    await expect(pay('associate', 50)).rejects.toThrow(/row-level security/);
    await expect(pay('owner', 51)).resolves.toBeTruthy();
    await expect(pay('owner', 51)).rejects.toThrow(/payments_chamber_id_receipt_no_key/);
    await expect(as('owner', () => app.query(`UPDATE payments SET amount_poisha = 1`))).rejects.toThrow(
      /permission denied/,
    );
    await expect(as('owner', () => app.query(`DELETE FROM payments`))).rejects.toThrow(/permission denied/);
  });

  it('the admin role has no access to documents, fees or payments', async () => {
    const admin = new pg.Client({ connectionString: testDb.adminUrl });
    await admin.connect();
    for (const t of ['documents', 'fees', 'payments']) {
      await expect(admin.query(`SELECT 1 FROM ${t} LIMIT 1`), t).rejects.toThrow(/permission denied/);
    }
    await expect(admin.query(`SELECT address FROM chambers LIMIT 1`)).rejects.toThrow(/permission denied/);
    await admin.end();
  });
});
