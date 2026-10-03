import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/**
 * M3 acceptance (plan.md 3.2): the admin portal's database role sees account fields and counts only,
 * never client data; support access needs an owner-approved grant that lasts at most 24 hours.
 */
let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;
let admin: pg.Client;
let app: pg.Client;
let adminId: string;
let otherAdminId: string;

async function asAdmin<T>(id: string, fn: () => Promise<T>): Promise<T> {
  await admin.query('BEGIN');
  try {
    await admin.query(`SELECT set_config('app.admin_id', $1, true)`, [id]);
    const out = await fn();
    await admin.query('COMMIT');
    return out;
  } catch (e) {
    await admin.query('ROLLBACK');
    throw e;
  }
}

async function grant(chamberId: string, who: string, state: 'pending' | 'active' | 'expired' | 'revoked') {
  const id = randomUUID();
  const approved = state === 'pending' ? null : state === 'expired' ? "now() - interval '25 hours'" : 'now()';
  const expires = approved ? `${approved} + interval '24 hours'` : null;
  await root.query(
    `INSERT INTO support_grants (id, chamber_id, admin_id, reason, approved_at, expires_at, revoked_at)
     VALUES ($1, $2, $3, 'Owner reported a problem', ${approved ?? 'NULL'}, ${expires ?? 'NULL'}, ${state === 'revoked' ? 'now()' : 'NULL'})`,
    [id, chamberId, who],
  );
  return id;
}

beforeAll(async () => {
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  admin = new pg.Client({ connectionString: testDb.adminUrl });
  app = new pg.Client({ connectionString: testDb.appUrl });
  await Promise.all([root.connect(), admin.connect(), app.connect()]);

  adminId = randomUUID();
  otherAdminId = randomUUID();
  for (const [id, n] of [
    [adminId, 1],
    [otherAdminId, 2],
  ] as const) {
    await root.query(
      `INSERT INTO platform_admins (id, phone, name, role, password_hash, totp_secret_enc, updated_at)
       VALUES ($1, $2, $3, 'support', 'hash', 'secret', now())`,
      [id, `+88019${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, `Admin ${n}`],
    );
  }

  // A client with contact and a case in chamber A, written as the table owner.
  const { a } = seed;
  const clientId = randomUUID();
  await root.query(
    `INSERT INTO clients (id, chamber_id, display_name, created_by, updated_at) VALUES ($1, $2, 'Secret Client', $3, now())`,
    [clientId, a.chamberId, a.members.owner.userId],
  );
  await root.query(
    `INSERT INTO client_contacts (client_id, chamber_id, phone_enc, updated_at) VALUES ($1, $2, 'enc', now())`,
    [clientId, a.chamberId],
  );
  const court = await root.query(`SELECT id FROM courts WHERE district = 'Chattogram' LIMIT 1`);
  await root.query(
    `INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, client_id, created_by, updated_at)
     VALUES ($1, $2, 'civil', '245', '2026', $3, 'plaintiff', $4, $5, now())`,
    [randomUUID(), a.chamberId, court.rows[0].id, clientId, a.members.owner.userId],
  );
});

afterAll(async () => {
  await Promise.all([root.end(), admin.end(), app.end()]);
});

describe('admin role: what it can never read', () => {
  it.each([
    'clients',
    'client_contacts',
    'hearings',
    'invitations',
    'audit_log',
    'tasks',
    'sessions',
    'otp_challenges',
  ])('has no access to %s', async (table) => {
    await expect(admin.query(`SELECT 1 FROM ${table} LIMIT 1`)).rejects.toThrow(/permission denied/);
  });

  it.each([
    ['cases', 'number'],
    ['cases', 'client_id'],
    ['cases', 'parties_text'],
    ['users', 'password_hash'],
    ['users', 'totp_secret_enc'],
    ['memberships', 'can_see_fees'],
  ])('has no access to %s.%s', async (table, column) => {
    await expect(admin.query(`SELECT ${column} FROM ${table} LIMIT 1`)).rejects.toThrow(/permission denied/);
  });

  it('sees only chamber owners among users', async () => {
    const { rows } = await admin.query(`SELECT id FROM users WHERE id = ANY($1)`, [
      [seed.a.members.owner.userId, seed.a.members.associate.userId, seed.a.members.staff.userId],
    ]);
    expect(rows.map((r) => r.id)).toEqual([seed.a.members.owner.userId]);
  });

  it('chamber overview gives account fields and counts only', async () => {
    const { rows } = await admin.query(`SELECT * FROM admin_chamber_overview WHERE id = $1`, [seed.a.chamberId]);
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        'case_count',
        'created_at',
        'district',
        'id',
        'member_count',
        'name',
        'owner_name',
        'owner_phone',
        'plan',
        'status',
        'trial_ends_at',
      ].sort(),
    );
    expect(rows[0]).toMatchObject({ member_count: 4, case_count: 1, owner_name: 'owner' });
  });

  it('cannot change anything but plan and status on a chamber', async () => {
    await expect(admin.query(`UPDATE chambers SET name = 'x' WHERE id = $1`, [seed.a.chamberId])).rejects.toThrow(
      /permission denied/,
    );
    const r = await admin.query(`UPDATE chambers SET plan = 'trial' WHERE id = $1`, [seed.a.chamberId]);
    expect(r.rowCount).toBe(1);
  });
});

describe('support access', () => {
  const cases = (chamberId: string) => admin.query(`SELECT * FROM admin_support_cases($1)`, [chamberId]);

  it('is refused without an admin identity', async () => {
    await expect(cases(seed.a.chamberId)).rejects.toThrow(/no admin context/);
  });

  it.each(['pending', 'expired', 'revoked'] as const)('is refused with a %s grant', async (state) => {
    await grant(seed.b.chamberId, adminId, state);
    await expect(asAdmin(adminId, () => cases(seed.b.chamberId))).rejects.toThrow(/no active support grant/);
  });

  it("is refused with another admin's grant", async () => {
    await grant(seed.a.chamberId, otherAdminId, 'active');
    await expect(asAdmin(adminId, () => cases(seed.a.chamberId))).rejects.toThrow(/no active support grant/);
  });

  it('with an approved grant shows case numbers but no client fields, and is logged for the owner', async () => {
    await grant(seed.a.chamberId, adminId, 'active');
    const { rows, fields } = await asAdmin(adminId, () => cases(seed.a.chamberId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ case_type: 'civil', number: '245', year: '2026' });
    expect(fields.map((f) => f.name).sort()).toEqual(
      ['case_type', 'court_name', 'court_no', 'next_date', 'number', 'status', 'year'].sort(),
    );
    expect(JSON.stringify(rows)).not.toContain('Secret Client');

    const logged = await root.query(
      `SELECT actor_kind FROM audit_log WHERE chamber_id = $1 AND action = 'support.view_cases'`,
      [seed.a.chamberId],
    );
    expect(logged.rows).toEqual([{ actor_kind: 'admin' }]);
    const adminLog = await root.query(`SELECT 1 FROM admin_audit_log WHERE admin_id = $1 AND chamber_id = $2`, [
      adminId,
      seed.a.chamberId,
    ]);
    expect(adminLog.rowCount).toBe(1);
  });

  it('does not leave the chamber context set after the call', async () => {
    const out = await asAdmin(adminId, async () => {
      await cases(seed.a.chamberId);
      return admin.query(`SELECT current_setting('app.chamber_id', true) AS c, current_setting('app.role', true) AS r`);
    });
    expect(out.rows[0]).toEqual({ c: '', r: '' });
  });

  it('a grant can never last more than 24 hours', async () => {
    await expect(
      root.query(
        `INSERT INTO support_grants (id, chamber_id, admin_id, reason, approved_at, expires_at)
         VALUES ($1, $2, $3, 'x', now(), now() + interval '25 hours')`,
        [randomUUID(), seed.a.chamberId, adminId],
      ),
    ).rejects.toThrow(/support_grants_window/);
  });

  it('a request goes through the function and is logged for the owner and the platform', async () => {
    await expect(
      admin.query(`INSERT INTO support_grants (id, chamber_id, admin_id, reason) VALUES ($1, $2, $3, 'x')`, [
        randomUUID(),
        seed.a.chamberId,
        adminId,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      admin.query(`SELECT admin_request_support($1, 'Owner reported a problem')`, [seed.a.chamberId]),
    ).rejects.toThrow(/no admin context/);
    await expect(
      asAdmin(adminId, () => admin.query(`SELECT admin_request_support($1, 'short')`, [seed.a.chamberId])),
    ).rejects.toThrow(/reason/);
    const { rows } = await asAdmin(adminId, () =>
      admin.query(`SELECT admin_request_support($1, 'Owner reported a sync problem') AS id`, [seed.a.chamberId]),
    );
    const id = rows[0].id as string;
    const grantRow = await root.query(`SELECT admin_id, approved_at FROM support_grants WHERE id = $1`, [id]);
    expect(grantRow.rows[0]).toEqual({ admin_id: adminId, approved_at: null });
    const owner = await root.query(
      `SELECT actor_kind FROM audit_log WHERE entity_id = $1 AND action = 'support.request'`,
      [id],
    );
    expect(owner.rowCount).toBe(1);
    const platform = await root.query(
      `SELECT 1 FROM admin_audit_log WHERE entity_id = $1 AND action = 'support.request'`,
      [id],
    );
    expect(platform.rowCount).toBe(1);
  });

  it('an admin cannot approve a grant', async () => {
    await expect(admin.query(`UPDATE support_grants SET approved_at = now()`)).rejects.toThrow(/permission denied/);
  });
});

describe('app role: what it can never read of the admin side', () => {
  it.each(['admin_sessions', 'admin_audit_log', 'subscription_payments'])('has no access to %s', async (table) => {
    await expect(app.query(`SELECT 1 FROM ${table} LIMIT 1`)).rejects.toThrow(/permission denied/);
  });

  it('cannot read admin password or TOTP secret', async () => {
    await expect(app.query(`SELECT password_hash FROM platform_admins`)).rejects.toThrow(/permission denied/);
    await expect(app.query(`SELECT totp_secret_enc FROM platform_admins`)).rejects.toThrow(/permission denied/);
  });

  it('sees support grants of its own chamber only', async () => {
    await app.query('BEGIN');
    await app.query(`SELECT set_config('app.chamber_id', $1, true)`, [seed.b.chamberId]);
    const { rows } = await app.query(`SELECT DISTINCT chamber_id FROM support_grants`);
    await app.query('COMMIT');
    expect(rows.map((r) => r.chamber_id)).toEqual([seed.b.chamberId]);
  });
});
