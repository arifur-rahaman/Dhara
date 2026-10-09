import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

// F8 is behind a flag; this file turns it on with a fake Google that records every call.
process.env.FEATURE_GOOGLE_CALENDAR = '1';
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

type Call = { url: string; method: string; body: string };
const calls: Call[] = [];
let nextEvent = 1;
const fakeGoogle: typeof fetch = async (input, init) => {
  const url = String(input);
  const body = typeof init?.body === 'string' ? init.body : String(init?.body ?? '');
  calls.push({ url, method: init?.method ?? 'GET', body });
  if (url.includes('oauth2.googleapis.com/token')) return Response.json({ access_token: 'access-1' });
  if (url.includes('/calendar/v3/'))
    return Response.json({ id: init?.method === 'PUT' ? url.split('/').pop() : `ev${nextEvent++}` });
  return new Response('unexpected', { status: 500 });
};

let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;
let assignedCase: string;
const SECRET_CLIENT = 'Calendar Secret Client';

const ctxOf = (role: 'owner' | 'associate') => ({
  userId: seed.a.members[role].userId,
  chamberId: seed.a.chamberId,
  membershipId: seed.a.members[role].membershipId,
  role,
  caseScope: 'assigned' as const,
  canSeeFees: false,
});

beforeAll(async () => {
  const google = await import('@/server/providers/google-calendar');
  google.setGoogleFetch(fakeGoogle);
  const { encryptField } = await import('@/server/crypto');
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  await root.connect();
  const { a } = seed;
  const court = (await root.query(`SELECT id FROM courts WHERE chamber_id IS NULL LIMIT 1`)).rows[0].id;
  const client = randomUUID();
  await root.query(
    `INSERT INTO clients (id, chamber_id, display_name, created_by, updated_at) VALUES ($1, $2, $3, $4, now())`,
    [client, a.chamberId, SECRET_CLIENT, a.members.owner.userId],
  );
  const mkCase = async (number: string, assignee: string) => {
    const id = randomUUID();
    await root.query(
      `INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, client_id, assignee_membership_id, created_by, updated_at)
       VALUES ($1, $2, 'civil', $3, '2026', $4, 'plaintiff', $5, $6, $7, now())`,
      [id, a.chamberId, number, court, client, assignee, a.members.owner.userId],
    );
    await root.query(
      `INSERT INTO hearings (id, chamber_id, case_id, date, serial_or_item, added_by, updated_at)
       VALUES ($1, $2, $3, (now() AT TIME ZONE 'Asia/Dhaka')::date + 3, '12', $4, now())`,
      [randomUUID(), a.chamberId, id, a.members.owner.userId],
    );
    return id;
  };
  assignedCase = await mkCase('245', a.members.associate.membershipId);
  await mkCase('310', a.members.owner.membershipId);
  for (const role of ['owner', 'associate'] as const) {
    await root.query(`INSERT INTO calendar_links (user_id, refresh_token_enc, updated_at) VALUES ($1, $2, now())`, [
      a.members[role].userId,
      encryptField(`refresh-${role}`),
    ]);
  }
});

afterAll(async () => {
  await root.end();
  const { prisma } = await import('@/server/db/client');
  await prisma.$disconnect();
});

describe('Google Calendar sync (F8)', () => {
  it('pushes the owner’s upcoming hearings as all-day events without client names', async () => {
    const { syncMyCalendar } = await import('@/features/calendar-sync/sync');
    calls.length = 0;
    expect(await syncMyCalendar(ctxOf('owner'), { force: true })).toEqual({ synced: 2 });
    const events = calls.filter((c) => c.url.includes('/events'));
    expect(events.map((e) => e.method)).toEqual(['POST', 'POST']);
    for (const e of events) {
      expect(e.body).not.toContain(SECRET_CLIENT);
      const ev = JSON.parse(e.body);
      expect(ev.start.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ev.summary).toMatch(/245\/2026|310\/2026/);
    }
    expect(calls[0].body).toContain('refresh_token=refresh-owner');
  });

  it('a second sync updates the same events instead of adding copies', async () => {
    const { syncMyCalendar } = await import('@/features/calendar-sync/sync');
    calls.length = 0;
    await syncMyCalendar(ctxOf('owner'), { force: true });
    expect(calls.filter((c) => c.url.includes('/events')).map((c) => c.method)).toEqual(['PUT', 'PUT']);
  });

  it('an associate gets only the cases assigned to them', async () => {
    const { syncMyCalendar } = await import('@/features/calendar-sync/sync');
    calls.length = 0;
    expect(await syncMyCalendar(ctxOf('associate'), { force: true })).toEqual({ synced: 1 });
    expect(calls.find((c) => c.url.includes('/events'))!.body).toContain(`/cases/${assignedCase}`);
  });

  it('nobody can read another person’s Google link or event map', async () => {
    const app = new pg.Client({ connectionString: testDb.appUrl });
    await app.connect();
    await app.query('BEGIN');
    await app.query(`SELECT set_config('app.user_id', $1, true)`, [seed.a.members.associate.userId]);
    const links = await app.query(`SELECT user_id FROM calendar_links`);
    const events = await app.query(`SELECT DISTINCT user_id FROM calendar_events`);
    await app.query('COMMIT');
    await app.end();
    expect(links.rows.map((r) => r.user_id)).toEqual([seed.a.members.associate.userId]);
    expect(events.rows.map((r) => r.user_id)).toEqual([seed.a.members.associate.userId]);
    const admin = new pg.Client({ connectionString: testDb.adminUrl });
    await admin.connect();
    await expect(admin.query(`SELECT 1 FROM calendar_links`)).rejects.toThrow(/permission denied/);
    await admin.end();
  });
});
