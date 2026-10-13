import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Ctx } from '@/server/authz';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/** F33: AI drafting is for owners and associates (P8); nothing identifying reaches the AI or the table. */
process.env.AI_PROVIDER = 'fake';
const req = vi.hoisted(() => ({ ctx: null as Ctx | null }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/server/context', () => ({
  requireCtx: async () => {
    if (!req.ctx) throw new Error('signed out');
    return req.ctx;
  },
  getCtx: async () => req.ctx,
}));

let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;
let caseId: string;
const SECRET = 'Secret Clientname';

const as = (
  role: 'owner' | 'associate' | 'munshi' | 'staff',
  chamber: 'a' | 'b' = 'a',
  scope: 'all' | 'assigned' = 'assigned',
) => {
  const c = seed[chamber];
  req.ctx = {
    userId: c.members[role].userId,
    chamberId: c.chamberId,
    membershipId: c.members[role].membershipId,
    role,
    caseScope: scope,
    canSeeFees: false,
  };
};
const input = (extra: Record<string, unknown> = {}) => ({
  kind: 'plaint',
  language: 'en',
  facts: `${SECRET} lent money to Rival Person on 1 March; call him on 01711-123456 or mail secret@example.com.`,
  names: ['Rival Person'],
  caseId,
  ...extra,
});
async function write(body: unknown) {
  const { POST } = await import('@/app/api/ai/draft/route');
  const res = await POST(new Request('http://x/api/ai/draft', { method: 'POST', body: JSON.stringify(body) }));
  if (res.status !== 200) return { status: res.status, lines: [] as Record<string, unknown>[] };
  const text = await res.text();
  return {
    status: 200,
    lines: text
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as Record<string, unknown>),
  };
}

beforeAll(async () => {
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  await root.connect();
  const court = (await root.query(`SELECT id FROM courts WHERE chamber_id IS NULL LIMIT 1`)).rows[0].id;
  const client = randomUUID();
  await root.query(
    `INSERT INTO clients (id, chamber_id, display_name, created_by, updated_at) VALUES ($1, $2, $3, $4, now())`,
    [client, seed.a.chamberId, SECRET, seed.a.members.owner.userId],
  );
  caseId = randomUUID();
  await root.query(
    `INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, client_id, assignee_membership_id, created_by, updated_at)
     VALUES ($1, $2, 'money_loan', '77', '2026', $3, 'plaintiff', $4, $5, $6, now())`,
    [caseId, seed.a.chamberId, court, client, seed.a.members.owner.membershipId, seed.a.members.owner.userId],
  );
});
afterAll(async () => {
  await root.end();
});

describe('AI drafting (F33, P8)', () => {
  it('munshi and staff cannot draft', async () => {
    const { checkDraft } = await import('@/features/drafting/actions');
    for (const role of ['munshi', 'staff'] as const) {
      as(role);
      expect(await checkDraft(input())).toEqual({ ok: false, error: 'notAllowed' });
      expect((await write(input())).status).toBe(404);
    }
  });

  it("an assigned-only associate cannot draft on the owner's case; without a case they can", async () => {
    const { checkDraft } = await import('@/features/drafting/actions');
    as('associate');
    expect(await checkDraft(input())).toEqual({ ok: false, error: 'notFound' });
    expect((await write(input())).status).toBe(404);
    expect(await checkDraft(input({ caseId: null }))).toMatchObject({ ok: true });
  });

  it('what reaches the AI has no client name, other names, phone or email', async () => {
    const { checkDraft } = await import('@/features/drafting/actions');
    as('owner');
    const r = await checkDraft(input());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.sent).not.toMatch(/Secret|Rival|01711|secret@/);
    expect(r.sent).toContain('[PERSON_');
    expect(r.items.map((i) => i.key)).toEqual([
      'parties',
      'causeDate',
      'jurisdiction',
      'valuation',
      'courtFee',
      'limitation',
      'relief',
    ]);
  });

  it('a written draft is stored redacted, with law-report citations removed and the name map encrypted', async () => {
    as('owner');
    const { status, lines } = await write(input());
    expect(status).toBe(200);
    expect(lines[0]).toMatchObject({ t: 'map' });
    const done = lines.at(-1)!;
    expect(done).toMatchObject({ t: 'done', removed: 1 });
    expect(String(done.text)).not.toContain('DLR');
    const row = (await root.query(`SELECT * FROM ai_drafts WHERE id = $1`, [done.id])).rows[0];
    expect(JSON.stringify(row)).not.toMatch(/Secret|Rival|01711|secret@example/);
    expect(row).toMatchObject({
      kind: 'plaint',
      case_id: caseId,
      removed_citations: 1,
      created_by: seed.a.members.owner.userId,
    });
  });

  it('each person sees their own drafts; the owner sees all in the chamber; other chambers none', async () => {
    as('associate', 'a', 'all');
    const mine = (await write(input({ caseId: null }))).lines.at(-1)!;
    const ownerDraft = (
      await root.query(`SELECT id FROM ai_drafts WHERE created_by = $1 LIMIT 1`, [seed.a.members.owner.userId])
    ).rows[0].id;
    const read = async (role: 'owner' | 'associate', chamber: 'a' | 'b', id: string) => {
      const app = new pg.Client({ connectionString: testDb.appUrl });
      await app.connect();
      try {
        await app.query('BEGIN');
        const c = seed[chamber];
        await app.query(
          `SELECT set_config('app.chamber_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', $3, true)`,
          [c.chamberId, c.members[role].userId, role],
        );
        return (await app.query(`SELECT id FROM ai_drafts WHERE id = $1`, [id])).rowCount;
      } finally {
        await app.query('ROLLBACK');
        await app.end();
      }
    };
    expect(await read('associate', 'a', String(mine.id))).toBe(1);
    expect(await read('associate', 'a', ownerDraft)).toBe(0);
    expect(await read('owner', 'a', String(mine.id))).toBe(1);
    expect(await read('owner', 'b', String(mine.id))).toBe(0);
  });
});
