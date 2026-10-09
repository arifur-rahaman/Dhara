import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Ctx } from '@/server/authz';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/**
 * M6: Excel/CSV import (F20), login devices with remote log out, and course progress (F24, F25).
 * Server actions run for real against the test database; only "who is signed in" is supplied here.
 */
const auth = vi.hoisted(() => ({ ctx: null as Ctx | null, sessionId: '' }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/server/context', () => ({
  requireCtx: async () => {
    if (!auth.ctx) throw new Error('signed out');
    return auth.ctx;
  },
}));
vi.mock('@/server/auth/session', async (original) => ({
  ...(await original<typeof import('@/server/auth/session')>()),
  getSession: async () => ({ id: auth.sessionId, userId: auth.ctx?.userId }),
}));

let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;
let districtCourt: { id: string; nameEn: string; nameBn: string };

const as = (
  role: 'owner' | 'associate' | 'munshi' | 'staff',
  chamber: 'a' | 'b' = 'a',
  scope: 'all' | 'assigned' = 'assigned',
) => {
  const c = seed[chamber];
  auth.ctx = {
    userId: c.members[role].userId,
    chamberId: c.chamberId,
    membershipId: c.members[role].membershipId,
    role,
    caseScope: scope,
    canSeeFees: false,
  };
};

const input = (rows: string[][], extra: Record<string, unknown> = {}) => ({
  rows,
  mapping: { number: 0, year: 1, court: 2, clientName: 3, nextDate: 4, type: 5 },
  defaults: { courtId: null, type: 'civil', ourSide: 'plaintiff' },
  assignee: null,
  ...extra,
});

beforeAll(async () => {
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  await root.connect();
  districtCourt = (
    await root.query(
      `SELECT id, name_en AS "nameEn", name_bn AS "nameBn" FROM courts WHERE chamber_id IS NULL AND district = 'Chattogram' LIMIT 1`,
    )
  ).rows[0];
});

afterAll(async () => {
  await root.end();
});

describe('import (F20)', () => {
  it('previews without saving: ready rows, duplicates inside the file, unknown courts and bad dates', async () => {
    const { previewImport } = await import('@/features/import/actions');
    as('owner');
    const before = (await root.query('SELECT count(*)::int AS n FROM cases WHERE chamber_id = $1', [seed.a.chamberId]))
      .rows[0].n;
    const result = await previewImport(
      input([
        ['101', '2026', districtCourt.nameEn, 'Preview Client', '12/11/2031', 'GR'],
        ['101', '2026', districtCourt.nameBn, 'Preview Client', '', ''],
        ['102', '2026', 'Moon Court', '', '', ''],
        ['103', '2026', districtCourt.nameEn, '', '31/02/2031', ''],
        ['', '2026', districtCourt.nameEn, '', '', ''],
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => r.status)).toEqual(['ok', 'duplicate', 'error', 'error', 'error']);
    expect(result.rows[2].errors).toEqual(['court']);
    expect(result.rows[3].errors).toEqual(['date']);
    expect(result.rows[4].errors).toEqual(['number']);
    expect(result.rows[0]).toMatchObject({ line: 2, nextDate: '2031-11-12', court: { nameEn: districtCourt.nameEn } });
    const after = (await root.query('SELECT count(*)::int AS n FROM cases WHERE chamber_id = $1', [seed.a.chamberId]))
      .rows[0].n;
    expect(after).toBe(before);
  });

  it("courts are matched by name only among this chamber's courts; the fallback covers rows with no match", async () => {
    const { previewImport } = await import('@/features/import/actions');
    // Chamber B's own court is invisible to chamber A, so its name matches nothing there.
    await root.query(
      `INSERT INTO courts (id, chamber_id, name_bn, name_en, level, district, updated_at)
       VALUES ($1, $2, 'বি চেম্বারের ট্রাইব্যুনাল', 'B Chamber Tribunal', 'district', 'Chattogram', now())`,
      [randomUUID(), seed.b.chamberId],
    );
    as('owner');
    const strict = await previewImport(input([['203', '2026', 'B Chamber Tribunal', '', '', '']]));
    expect(strict.ok && strict.rows[0].errors).toEqual(['court']);
    const withFallback = await previewImport(
      input(
        [
          ['201', '2026', 'B Chamber Tribunal', '', '', ''],
          ['202', '2026', '', '', '', ''],
        ],
        { defaults: { courtId: districtCourt.id, type: 'civil', ourSide: 'defendant' } },
      ),
    );
    expect(withFallback.ok && withFallback.rows.map((r) => [r.status, r.court?.nameEn ?? null])).toEqual([
      ['ok', districtCourt.nameEn],
      ['ok', districtCourt.nameEn],
    ]);
    // A fallback court the chamber cannot pick is ignored.
    as('owner', 'b');
    const own = (await root.query(`SELECT id FROM courts WHERE chamber_id = $1`, [seed.b.chamberId])).rows[0].id;
    as('owner', 'a');
    const foreign = await previewImport(
      input([['204', '2026', '', '', '', '']], { defaults: { courtId: own, type: 'civil', ourSide: 'plaintiff' } }),
    );
    expect(foreign.ok && foreign.rows[0].errors).toEqual(['court']);
  });

  it('saves ready rows with clients and dates, skips the rest, and writes an audit entry without row data', async () => {
    const { commitImport } = await import('@/features/import/actions');
    as('owner');
    const result = await commitImport(
      input([
        ['301', '২০২৬', districtCourt.nameEn, 'Import Client One', '12/11/2031', 'জিআর'],
        ['302', '2026', districtCourt.nameEn, 'import client one', '', ''],
        ['303', '2026', 'Moon Court', 'Never Saved', '', ''],
      ]),
    );
    expect(result).toEqual({ ok: true, cases: 2, clients: 1, hearings: 1, skipped: 1 });
    const rows = (
      await root.query(
        `SELECT c.number, c.year, c.type, c.assignee_membership_id, cl.display_name
         FROM cases c LEFT JOIN clients cl ON cl.id = c.client_id
         WHERE c.chamber_id = $1 AND c.number IN ('301', '302', '303') ORDER BY c.number`,
        [seed.a.chamberId],
      )
    ).rows;
    expect(rows).toEqual([
      {
        number: '301',
        year: '2026',
        type: 'criminal_gr',
        assignee_membership_id: seed.a.members.owner.membershipId,
        display_name: 'Import Client One',
      },
      {
        number: '302',
        year: '2026',
        type: 'civil',
        assignee_membership_id: seed.a.members.owner.membershipId,
        display_name: 'Import Client One',
      },
    ]);
    const audit = (
      await root.query(`SELECT fields FROM audit_log WHERE chamber_id = $1 AND action = 'import.cases'`, [
        seed.a.chamberId,
      ])
    ).rows;
    expect(audit).toEqual([{ fields: { cases: 2, clients: 1, hearings: 1, skipped: 1 } }]);
    expect(JSON.stringify(audit)).not.toContain('Import Client One');

    // Importing the same file again adds nothing.
    const again = await commitImport(input([['301', '2026', districtCourt.nameEn, '', '', '']]));
    expect(again).toEqual({ ok: false, error: 'nothing' });
  });

  it('never imports client contact, even when the owner maps a phone column', async () => {
    const { commitImport } = await import('@/features/import/actions');
    as('owner');
    const before = (
      await root.query('SELECT count(*)::int AS n FROM client_contacts WHERE chamber_id = $1', [seed.a.chamberId])
    ).rows[0].n;
    const result = await commitImport({
      ...input([['401', '2026', districtCourt.nameEn, 'Phone Client', '', '', '+8801711000000']]),
      mapping: { number: 0, year: 1, court: 2, clientName: 3, phone: 6 },
    });
    // The extra "phone" mapping is not an import field: the whole request is refused.
    expect(result).toEqual({ ok: false, error: 'invalid' });
    const ok = await commitImport(
      input([['402', '2026', districtCourt.nameEn, 'Phone Client', '', '', '+8801711000000']]),
    );
    expect(ok.ok).toBe(true);
    const after = (
      await root.query('SELECT count(*)::int AS n FROM client_contacts WHERE chamber_id = $1', [seed.a.chamberId])
    ).rows[0].n;
    expect(after).toBe(before);
    const stored = (
      await root.query(`SELECT * FROM cases WHERE chamber_id = $1 AND number = '402'`, [seed.a.chamberId])
    ).rows[0];
    expect(JSON.stringify(stored)).not.toContain('8801711000000');
  });

  it("an associate's imported cases are theirs; they cannot hand them to someone else", async () => {
    const { commitImport } = await import('@/features/import/actions');
    as('associate');
    const refused = await commitImport(
      input([['501', '2026', districtCourt.nameEn, '', '', '']], { assignee: seed.a.members.owner.membershipId }),
    );
    expect(refused).toEqual({ ok: false, error: 'assignee' });
    const ok = await commitImport(input([['501', '2026', districtCourt.nameEn, '', '', '']]));
    expect(ok.ok).toBe(true);
    const row = (
      await root.query(`SELECT assignee_membership_id FROM cases WHERE chamber_id = $1 AND number = '501'`, [
        seed.a.chamberId,
      ])
    ).rows[0];
    expect(row.assignee_membership_id).toBe(seed.a.members.associate.membershipId);
  });

  it('the owner may assign imported cases only to an active owner or associate of the same chamber', async () => {
    const { commitImport } = await import('@/features/import/actions');
    as('owner');
    for (const assignee of [seed.a.members.munshi.membershipId, seed.b.members.associate.membershipId]) {
      expect(await commitImport(input([['601', '2026', districtCourt.nameEn, '', '', '']], { assignee }))).toEqual({
        ok: false,
        error: 'assignee',
      });
    }
    const ok = await commitImport(
      input([['601', '2026', districtCourt.nameEn, '', '', '']], { assignee: seed.a.members.associate.membershipId }),
    );
    expect(ok.ok).toBe(true);
  });

  it('munshi and staff cannot import or preview', async () => {
    const { commitImport, previewImport } = await import('@/features/import/actions');
    for (const role of ['munshi', 'staff'] as const) {
      as(role);
      await expect(previewImport(input([['701', '2026', districtCourt.nameEn, '', '', '']]))).rejects.toThrow();
      await expect(commitImport(input([['701', '2026', districtCourt.nameEn, '', '', '']]))).rejects.toThrow();
    }
    const n = (
      await root.query(`SELECT count(*)::int AS n FROM cases WHERE number = '701' AND chamber_id = $1`, [
        seed.a.chamberId,
      ])
    ).rows[0].n;
    expect(n).toBe(0);
  });

  it("an assigned-only associate's duplicate check sees only their own cases, so nothing leaks", async () => {
    const { previewImport } = await import('@/features/import/actions');
    as('associate');
    // Case 301 belongs to the owner. The associate cannot see it, so the preview says "ready", not "already here".
    const result = await previewImport(input([['301', '2026', districtCourt.nameEn, '', '', '']]));
    expect(result.ok && result.rows[0].status).toBe('ok');
  });

  it('the importer cannot write into another chamber', async () => {
    const { commitImport } = await import('@/features/import/actions');
    as('owner', 'b');
    const ok = await commitImport(input([['801', '2026', districtCourt.nameEn, 'B Client', '', '']]));
    expect(ok.ok).toBe(true);
    const rows = (
      await root.query(`SELECT chamber_id FROM cases WHERE number = '801' AND chamber_id = ANY($1)`, [
        [seed.a.chamberId, seed.b.chamberId],
      ])
    ).rows;
    expect(rows).toEqual([{ chamber_id: seed.b.chamberId }]);
  });
});

describe('login devices (Settings)', () => {
  const makeSession = async (userId: string) => {
    const id = randomUUID();
    await root.query(
      `INSERT INTO sessions (id, token_hash, user_id, mfa_verified_at, user_agent, expires_at)
       VALUES ($1, $2, $3, now(), 'Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile Safari/537.36', now() + interval '1 day')`,
      [id, `hash-${id}`, userId],
    );
    return id;
  };

  it('logs out another device and forgets its push subscription; this device stays signed in', async () => {
    const { signOutDevices } = await import('@/features/account/actions');
    as('associate');
    const userId = seed.a.members.associate.userId;
    const here = await makeSession(userId);
    const phone = await makeSession(userId);
    const laptop = await makeSession(userId);
    await root.query(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, session_id)
       VALUES ($1, $2, $6, 'p256dh-key-0000', 'auth-key-000', $3),
              ($4, $2, $7, 'p256dh-key-0000', 'auth-key-000', $5)`,
      [
        randomUUID(),
        userId,
        phone,
        randomUUID(),
        here,
        `https://push.example/${phone}`,
        `https://push.example/${here}`,
      ],
    );
    auth.sessionId = here;

    const form = new FormData();
    form.set('session', phone);
    await signOutDevices(form);
    const state = async () =>
      Object.fromEntries(
        (
          await root.query(`SELECT id, revoked_at IS NOT NULL AS ended FROM sessions WHERE id = ANY($1)`, [
            [here, phone, laptop],
          ])
        ).rows.map((r) => [r.id, r.ended]),
      );
    expect(await state()).toEqual({ [here]: false, [phone]: true, [laptop]: false });
    const subs = (
      await root.query(`SELECT endpoint FROM push_subscriptions WHERE user_id = $1 ORDER BY endpoint`, [userId])
    ).rows;
    expect(subs).toEqual([{ endpoint: `https://push.example/${here}` }]);

    form.set('session', 'others');
    await signOutDevices(form);
    expect(await state()).toEqual({ [here]: false, [phone]: true, [laptop]: true });
    const audit = (
      await root.query(
        `SELECT count(*)::int AS n FROM audit_log WHERE actor_user_id = $1 AND action = 'auth.sign_out_device'`,
        [userId],
      )
    ).rows[0].n;
    expect(audit).toBe(2);
  });

  it("cannot log out someone else's session, nor this device through the device list", async () => {
    const { signOutDevices } = await import('@/features/account/actions');
    const victim = await makeSession(seed.b.members.owner.userId);
    as('associate');
    const here = await makeSession(seed.a.members.associate.userId);
    auth.sessionId = here;
    for (const target of [victim, here, 'not-a-uuid']) {
      const form = new FormData();
      form.set('session', target);
      await signOutDevices(form);
    }
    const rows = (await root.query(`SELECT revoked_at FROM sessions WHERE id = ANY($1)`, [[victim, here]])).rows;
    expect(rows.every((r) => r.revoked_at === null)).toBe(true);
  });

  it('push subscriptions can only be tied to the person’s own session', async () => {
    const app = new pg.Client({ connectionString: testDb.appUrl });
    await app.connect();
    const mine = await makeSession(seed.a.members.munshi.userId);
    const theirs = await makeSession(seed.b.members.munshi.userId);
    try {
      await app.query('BEGIN');
      await app.query(`SELECT set_config('app.user_id', $1, true)`, [seed.a.members.munshi.userId]);
      await app.query(`SELECT app_claim_push_endpoint($2, 'p256dh-key-0000', 'auth-key-000', 'ua', $1)`, [
        mine,
        `https://push.example/${mine}`,
      ]);
      await expect(
        app.query(`SELECT app_claim_push_endpoint($2, 'p256dh-key-0000', 'auth-key-000', 'ua', $1)`, [
          theirs,
          `https://push.example/${theirs}`,
        ]),
      ).rejects.toThrow(/bad session/);
      await app.query('ROLLBACK');
    } finally {
      await app.end();
    }
  });

  it('font size is saved on the account, and only sm, md or lg', async () => {
    const { setTextSize } = await import('@/features/account/actions');
    as('staff');
    await setTextSize('lg');
    const read = async () =>
      (await root.query(`SELECT text_size FROM users WHERE id = $1`, [seed.a.members.staff.userId])).rows[0].text_size;
    expect(await read()).toBe('lg');
    await setTextSize('md');
    expect(await read()).toBeNull();
    await expect(setTextSize('huge')).rejects.toThrow();
    await expect(
      root.query(`UPDATE users SET text_size = 'xl' WHERE id = $1`, [seed.a.members.staff.userId]),
    ).rejects.toThrow();
  });
});

describe('courses (F24, F25)', () => {
  it('lists the basic computer course with its six modules from content/courses.json', async () => {
    const { listCourses } = await import('@/features/learning/queries');
    const courses = await listCourses(seed.a.members.staff.userId, 'bn');
    const basic = courses.find((c) => c.id === 'basic-computer');
    expect(basic?.modules.map((m) => m.title)).toEqual([
      'বাংলা ও ইংরেজি টাইপিং',
      'Word-এ আরজি ও নোটিশের ফরম্যাট',
      'PDF স্ক্যান, মার্জ, সাইন',
      'ইমেইল আর Google Drive',
      'সাইবার সিকিউরিটি',
      'ধারা অ্যাপ ব্যবহার',
    ]);
  });

  it('progress is personal: marking a module done changes only your own progress', async () => {
    const { setModuleDone } = await import('@/features/learning/actions');
    const { listCourses } = await import('@/features/learning/queries');
    as('munshi');
    const form = new FormData();
    form.set('moduleId', 'basic-computer-2');
    form.set('done', '1');
    await setModuleDone(form);
    await setModuleDone(form); // twice is fine
    const doneFor = async (userId: string) =>
      (await listCourses(userId, 'en'))
        .find((c) => c.id === 'basic-computer')!
        .modules.filter((m) => m.done)
        .map((m) => m.id);
    expect(await doneFor(seed.a.members.munshi.userId)).toEqual(['basic-computer-2']);
    expect(await doneFor(seed.a.members.owner.userId)).toEqual([]);
    form.set('done', '0');
    await setModuleDone(form);
    expect(await doneFor(seed.a.members.munshi.userId)).toEqual([]);
  });

  it('the app role cannot read or write anyone else’s progress, nor change course content', async () => {
    await root.query(`INSERT INTO course_progress (user_id, module_id) VALUES ($1, 'basic-computer-1')`, [
      seed.b.members.owner.userId,
    ]);
    const app = new pg.Client({ connectionString: testDb.appUrl });
    await app.connect();
    try {
      await app.query('BEGIN');
      await app.query(`SELECT set_config('app.user_id', $1, true)`, [seed.a.members.owner.userId]);
      expect((await app.query(`SELECT * FROM course_progress`)).rows).toEqual([]);
      await expect(
        app.query(`INSERT INTO course_progress (user_id, module_id) VALUES ($1, 'basic-computer-3')`, [
          seed.b.members.owner.userId,
        ]),
      ).rejects.toThrow(/row-level security/);
      await app.query('ROLLBACK');
      await app.query('BEGIN');
      await expect(app.query(`UPDATE course_modules SET video_url = 'https://evil.example/x.mp4'`)).rejects.toThrow(
        /permission denied/,
      );
      await app.query('ROLLBACK');
    } finally {
      await app.end();
    }
    const admin = new pg.Client({ connectionString: testDb.adminUrl });
    await admin.connect();
    try {
      await expect(admin.query(`SELECT * FROM course_progress`)).rejects.toThrow(/permission denied/);
    } finally {
      await admin.end();
    }
  });
});
