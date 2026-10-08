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
