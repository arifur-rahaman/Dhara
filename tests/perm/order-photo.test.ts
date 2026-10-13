import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Ctx } from '@/server/authz';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/** F37: who may have an order photo read, the owner's switch, and what is saved after confirming. */
process.env.AI_PROVIDER = 'fake';
const req = vi.hoisted(() => ({ ctx: null as Ctx | null }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('next/server', async (original) => ({ ...(await original<object>()), after: () => undefined }));
vi.mock('@/features/preferences/server', () => ({ getPreferences: async () => ({ locale: 'en', numerals: 'latn' }) }));
vi.mock('@/server/context', () => ({
  requireCtx: async () => {
    if (!req.ctx) throw new Error('signed out');
    return req.ctx;
  },
}));

let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;
let ownersCase: string;
let associatesCase: string;
// A real (tiny) JPEG header is enough: the fake provider does not look at the pixels.
const jpeg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]).toString('base64')}`;

const as = (role: 'owner' | 'associate' | 'munshi' | 'staff', chamber: 'a' | 'b' = 'a') => {
  const c = seed[chamber];
  req.ctx = {
    userId: c.members[role].userId,
    chamberId: c.chamberId,
    membershipId: c.members[role].membershipId,
    role,
    caseScope: 'assigned',
    canSeeFees: false,
  };
};

beforeAll(async () => {
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  await root.connect();
  const court = (await root.query(`SELECT id FROM courts WHERE chamber_id IS NULL LIMIT 1`)).rows[0].id;
  const mk = async (assignee: string, number: string) => {
    const id = randomUUID();
    await root.query(
      `INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, assignee_membership_id, created_by, updated_at)
       VALUES ($1, $2, 'civil', $3, '2026', $4, 'plaintiff', $5, $6, now())`,
      [id, seed.a.chamberId, number, court, assignee, seed.a.members.owner.userId],
    );
    return id;
  };
  ownersCase = await mk(seed.a.members.owner.membershipId, '901');
  associatesCase = await mk(seed.a.members.associate.membershipId, '902');
});
afterAll(async () => {
  await root.end();
});

describe('order photo reading (F37)', () => {
  it('is off until the owner turns it on; only the owner can, and it is audited', async () => {
    const { readOrderPhoto } = await import('@/features/order-photo/actions');
    const { setAiPhotoReading } = await import('@/features/chamber/actions');
    as('munshi');
    expect(await readOrderPhoto({ caseId: ownersCase, image: jpeg })).toEqual({ ok: false, error: 'off' });
    const on = new FormData();
    on.set('on', '1');
    await expect(setAiPhotoReading(on)).rejects.toThrow();
    as('owner');
    await setAiPhotoReading(on);
    const audit = (
      await root.query(`SELECT fields FROM audit_log WHERE chamber_id = $1 AND action = 'chamber.ai_photo_reading'`, [
        seed.a.chamberId,
      ])
    ).rows;
    expect(audit).toEqual([{ fields: { on: true } }]);
  });

  it('reads for people who may add a date to the case (P4); the result is not saved', async () => {
    const { readOrderPhoto } = await import('@/features/order-photo/actions');
    as('munshi');
    const before = (await root.query(`SELECT count(*)::int AS n FROM hearings WHERE case_id = $1`, [ownersCase]))
      .rows[0].n;
    const r = await readOrderPhoto({ caseId: ownersCase, image: jpeg });
    expect(r).toMatchObject({ ok: true, dateConfidence: 'clear', caseMatch: 'unknown' });
    const after = (await root.query(`SELECT count(*)::int AS n FROM hearings WHERE case_id = $1`, [ownersCase])).rows[0]
      .n;
    expect(after).toBe(before);

    as('associate'); // assigned-only: the owner's case is not theirs
    expect(await readOrderPhoto({ caseId: ownersCase, image: jpeg })).toEqual({ ok: false, error: 'notFound' });
    expect(await readOrderPhoto({ caseId: associatesCase, image: jpeg })).toMatchObject({ ok: true });
    as('staff');
    expect(await readOrderPhoto({ caseId: ownersCase, image: jpeg })).toEqual({ ok: false, error: 'notFound' });
    as('owner', 'b'); // another chamber
    expect(await readOrderPhoto({ caseId: ownersCase, image: jpeg })).toMatchObject({ ok: false });
  });

  it('refuses what is not a JPEG, PNG or WebP image, and anything too large', async () => {
    const { readOrderPhoto } = await import('@/features/order-photo/actions');
    as('owner');
    const fakeJpeg = `data:image/jpeg;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`;
    expect(await readOrderPhoto({ caseId: ownersCase, image: fakeJpeg })).toEqual({ ok: false, error: 'badImage' });
    expect(await readOrderPhoto({ caseId: ownersCase, image: 'data:text/html;base64,PGI+' })).toEqual({
      ok: false,
      error: 'badImage',
    });
    const big = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(710_000)]).toString('base64')}`;
    expect(await readOrderPhoto({ caseId: ownersCase, image: big })).toMatchObject({ ok: false });
  });

  it('saving the confirmed reading adds the date with the summary, audited, through the P4 check', async () => {
    const { saveOrderReading } = await import('@/features/order-photo/actions');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
    const next = new Date(`${today}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 21);
    const date = next.toISOString().slice(0, 10);

    as('associate');
    expect(await saveOrderReading({ caseId: ownersCase, date, summary: 'x' })).toEqual({
      ok: false,
      error: 'notFound',
    });
    as('munshi');
    expect(await saveOrderReading({ caseId: ownersCase, date: '2001-01-01', summary: 'x' })).toEqual({
      ok: false,
      error: 'dateInvalid',
    });
    expect(await saveOrderReading({ caseId: ownersCase, date, summary: 'Time petition allowed' })).toEqual({
      ok: true,
    });
    const rows = (
      await root.query(
        `SELECT to_char(date, 'YYYY-MM-DD') AS date, outcome_note FROM hearings WHERE case_id = $1 ORDER BY date`,
        [ownersCase],
      )
    ).rows;
    expect(rows).toContainEqual({ date, outcome_note: null });
    expect(rows).toContainEqual({ date: today, outcome_note: 'Time petition allowed' });
    const n = (
      await root.query(
        `SELECT count(*)::int AS n FROM audit_log WHERE entity_id = $1 AND action = 'ai.order_photo_saved'`,
        [ownersCase],
      )
    ).rows[0].n;
    expect(n).toBe(1);
  });
});
