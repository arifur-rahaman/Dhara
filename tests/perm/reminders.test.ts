import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/** F5: reminder counts follow P3 visibility, are claimed once per day, and never leave counts-only. */
let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;
let jobs: pg.Client;
const DAY = '2031-03-10';
const NEXT = '2031-03-11';

beforeAll(async () => {
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  jobs = new pg.Client({ connectionString: testDb.jobsUrl });
  await Promise.all([root.connect(), jobs.connect()]);
  const { a } = seed;
  const court = (await root.query(`SELECT id FROM courts WHERE chamber_id IS NULL LIMIT 1`)).rows[0].id;
  const mkCase = async (assignee: string) => {
    const id = randomUUID();
    await root.query(
      `INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, assignee_membership_id, created_by, updated_at)
       VALUES ($1, $2, 'civil', '1', '2031', $3, 'plaintiff', $4, $5, now())`,
      [id, a.chamberId, court, assignee, a.members.owner.userId],
    );
    return id;
  };
  const assigned = await mkCase(a.members.associate.membershipId);
  const other = await mkCase(a.members.owner.membershipId);
  for (const [caseId, date] of [
    [assigned, NEXT],
    [other, NEXT],
    [other, DAY],
  ]) {
    await root.query(
      `INSERT INTO hearings (id, chamber_id, case_id, date, added_by, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
      [randomUUID(), a.chamberId, caseId, date, a.members.owner.userId],
    );
  }
  await root.query(
    `INSERT INTO tasks (id, chamber_id, assignee_membership_id, title, due_on, created_by, updated_at)
     VALUES ($1, $2, $3, 'File to court', $4, $5, now())`,
    [randomUUID(), a.chamberId, a.members.staff.membershipId, DAY, a.members.owner.userId],
  );
  // Only chamber A's people get reminders at 21:13; everyone else keeps their own times.
  const ids = Object.values(a.members).map((m) => m.userId);
  await root.query(
    `UPDATE users SET reminder_night_at = '21:13', reminder_morning_at = '06:47', locale = 'bn' WHERE id = ANY($1)`,
    [ids],
  );
  await root.query(`UPDATE users SET reminder_night_on = false WHERE id = $1`, [a.members.munshi.userId]);
});

afterAll(async () => {
  await Promise.all([root.end(), jobs.end()]);
});

const claim = async (kind: string, hhmm: string) =>
  (await jobs.query(`SELECT * FROM jobs_claim_reminders($1, $2, $3::date)`, [kind, hhmm, DAY])).rows as {
    user_id: string;
    hearings: number;
    tasks: number;
    locale: string;
  }[];

describe('reminder claims (F5)', () => {
  it("night: tomorrow's hearings per person by what they may see; switched-off people get nothing", async () => {
    const rows = await claim('night', '21:13');
    const by = new Map(rows.map((r) => [r.user_id, r.hearings]));
    const { members } = seed.a;
    expect(by.get(members.owner.userId)).toBe(2);
    expect(by.get(members.associate.userId)).toBe(1); // assigned case only
    expect(by.get(members.staff.userId)).toBe(2);
    expect(by.has(members.munshi.userId)).toBe(false); // turned off
    expect(Object.keys(rows[0]).sort()).toEqual(['hearings', 'locale', 'numerals', 'tasks', 'user_id']);
  });

  it('a second tick the same day sends nothing again', async () => {
    expect(await claim('night', '21:13')).toEqual([]);
  });

  it("morning: today's hearings and open tasks; people with nothing get no reminder", async () => {
    const rows = await claim('morning', '06:47');
    const by = new Map(rows.map((r) => [r.user_id, r]));
    const { members } = seed.a;
    expect(by.get(members.owner.userId)).toMatchObject({ hearings: 1, tasks: 0 });
    expect(by.get(members.staff.userId)).toMatchObject({ hearings: 1, tasks: 1 });
    expect(by.has(members.associate.userId)).toBe(false); // nothing today on the assigned case
  });

  it('writes an in-app notification with counts only', async () => {
    const { rows } = await root.query(
      `SELECT kind, payload FROM notifications WHERE user_id = $1 ORDER BY created_at`,
      [seed.a.members.owner.userId],
    );
    expect(rows.map((r) => r.kind)).toEqual(['reminder.night', 'reminder.morning']);
    expect(Object.keys(rows[0].payload).sort()).toEqual(['date', 'hearings', 'tasks']);
  });

  it('the jobs role cannot read chamber tables or call anything else', async () => {
    for (const table of ['cases', 'hearings', 'clients', 'users', 'memberships', 'notifications', 'tasks']) {
      await expect(jobs.query(`SELECT 1 FROM ${table} LIMIT 1`), table).rejects.toThrow(/permission denied/);
    }
    await expect(jobs.query(`SELECT * FROM admin_support_cases($1)`, [seed.a.chamberId])).rejects.toThrow(
      /permission denied/,
    );
    await expect(claim('lunch', '12:00')).rejects.toThrow(/bad reminder arguments/);
  });
});

describe('notice pushes (F18)', () => {
  it("a munshi's next date reaches the owner and the assignee as a counts-only push claim, once", async () => {
    const { applyNextDate } = await import('@/features/cases/next-date');
    const { withTenant } = await import('@/server/db/tenant');
    const { a } = seed;
    const caseId = (
      await root.query(`SELECT id FROM cases WHERE chamber_id = $1 AND assignee_membership_id = $2 LIMIT 1`, [
        a.chamberId,
        a.members.associate.membershipId,
      ])
    ).rows[0].id;
    const munshi = {
      userId: a.members.munshi.userId,
      chamberId: a.chamberId,
      membershipId: a.members.munshi.membershipId,
      role: 'munshi' as const,
      caseScope: 'all' as const,
      canSeeFees: false,
    };
    const result = await withTenant({ chamberId: a.chamberId, userId: munshi.userId, role: 'munshi' }, (tx) =>
      applyNextDate(tx, munshi, { caseId, date: '2031-04-02' }, DAY),
    );
    expect(result).toBe('ok');

    const mine = <T extends { user_id: string }>(rows: T[]) =>
      rows.filter((r) => Object.values(a.members).some((m) => m.userId === r.user_id));
    const first = mine(
      (
        await jobs.query<{ user_id: string; dates: number; tasks: number; other: number }>(
          `SELECT * FROM jobs_claim_push_notices()`,
        )
      ).rows,
    );
    const by = new Map(first.map((r) => [r.user_id, r]));
    expect(by.get(a.members.owner.userId)).toMatchObject({ dates: 1, tasks: 0, other: 0 });
    expect(by.get(a.members.associate.userId)).toMatchObject({ dates: 1, tasks: 0, other: 0 });
    expect(by.has(a.members.munshi.userId)).toBe(false); // not told about their own change
    // Reminders (pushed by their own job) are never claimed here.
    expect(first.every((r) => r.other === 0)).toBe(true);
    expect(Object.keys(first[0]).sort()).toEqual(['dates', 'locale', 'numerals', 'other', 'tasks', 'user_id']);

    expect(mine((await jobs.query(`SELECT * FROM jobs_claim_push_notices()`)).rows)).toEqual([]);
  });

  it('notices older than a day are not pushed late; the app role cannot call the claim', async () => {
    await root.query(
      `INSERT INTO notifications (id, user_id, chamber_id, kind, payload, created_at)
       VALUES ($1, $2, $3, 'task.assigned', '{}', now() - interval '2 days')`,
      [randomUUID(), seed.a.members.staff.userId, seed.a.chamberId],
    );
    const rows = (await jobs.query(`SELECT * FROM jobs_claim_push_notices()`)).rows;
    expect(rows.some((r) => r.user_id === seed.a.members.staff.userId)).toBe(false);
    const app = new pg.Client({ connectionString: testDb.appUrl });
    await app.connect();
    try {
      await expect(app.query(`SELECT * FROM jobs_claim_push_notices()`)).rejects.toThrow(/permission denied/);
    } finally {
      await app.end();
    }
  });
});
