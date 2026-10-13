import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Ctx } from '@/server/authz';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/** F38: summaries of uploaded judgments and orders follow the document's own visibility (P5, P6, P8). */
process.env.AI_PROVIDER = 'fake';
const req = vi.hoisted(() => ({ ctx: null as Ctx | null }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT ${url}`), { url });
  },
}));
vi.mock('@/features/preferences/server', () => ({ getPreferences: async () => ({ locale: 'en', numerals: 'latn' }) }));
vi.mock('@/server/providers/storage', () => ({
  storage: () => ({ read: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]) }),
}));
vi.mock('@/server/context', () => ({
  requireCtx: async () => {
    if (!req.ctx) throw new Error('signed out');
    return req.ctx;
  },
}));

let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;
const docs: Record<string, string> = {};

const as = (role: 'owner' | 'associate' | 'munshi', scope: 'all' | 'assigned' = 'assigned') => {
  const c = seed.a;
  req.ctx = {
    userId: c.members[role].userId,
    chamberId: c.chamberId,
    membershipId: c.members[role].membershipId,
    role,
    caseScope: scope,
    canSeeFees: false,
  };
};
const run = async (documentId: string) => {
  const { summarizeDocument } = await import('@/features/summaries/actions');
  const f = new FormData();
  f.set('documentId', documentId);
  try {
    await summarizeDocument(f);
    return 'no redirect';
  } catch (e) {
    return (e as { url?: string }).url ?? String(e);
  }
};
const visibleTo = async (role: 'owner' | 'associate' | 'munshi', scope: 'all' | 'assigned', documentId: string) => {
  const app = new pg.Client({ connectionString: testDb.appUrl });
  await app.connect();
  try {
    await app.query('BEGIN');
    const m = seed.a.members[role];
    await app.query(
      `SELECT set_config('app.chamber_id', $1, true), set_config('app.user_id', $2, true), set_config('app.role', $3, true)`,
      [seed.a.chamberId, m.userId, role],
    );
    await root.query(`UPDATE memberships SET case_scope = $1 WHERE id = $2`, [scope, m.membershipId]);
    return (await app.query(`SELECT 1 FROM ai_summaries WHERE document_id = $1`, [documentId])).rowCount;
  } finally {
    await app.query('ROLLBACK');
    await app.end();
  }
};

beforeAll(async () => {
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  await root.connect();
  const court = (await root.query(`SELECT id FROM courts WHERE chamber_id IS NULL LIMIT 1`)).rows[0].id;
  const caseId = randomUUID();
  await root.query(
    `INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, assignee_membership_id, created_by, updated_at)
     VALUES ($1, $2, 'civil', '12', '2026', $3, 'plaintiff', $4, $5, now())`,
    [caseId, seed.a.chamberId, court, seed.a.members.owner.membershipId, seed.a.members.owner.userId],
  );
  for (const [name, kind, confidential] of [
    ['judgment', 'pleading', false],
    ['order', 'order', false],
    ['private', 'other', true],
  ] as const) {
    const id = randomUUID();
    await root.query(
      `INSERT INTO documents (id, chamber_id, case_id, kind, title, file_name, content_type, size_bytes, storage_key, confidential, status, uploaded_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'f.pdf', 'application/pdf', 4, $6, $7, 'ready', $8, now())`,
      [id, seed.a.chamberId, caseId, kind, name, `k/${id}`, confidential, seed.a.members.owner.userId],
    );
    docs[name] = id;
  }
});
afterAll(async () => {
  await root.end();
});

describe('document summaries (F38)', () => {
  it('needs the owner to allow AI reading; munshi cannot ask; an assigned-only associate cannot reach the case', async () => {
    as('owner');
    expect(await run(docs.judgment)).toBe(`/documents/${docs.judgment}/summary?error=off`);
    await root.query(`UPDATE chambers SET ai_photo_reading = true WHERE id = $1`, [seed.a.chamberId]);
    as('munshi');
    expect(await run(docs.order)).toBe(`/documents/${docs.order}/summary?error=notAllowed`);
    as('associate', 'assigned');
    expect(await run(docs.judgment)).toBe(`/documents/${docs.judgment}/summary?error=notFound`);
  });

  it('the owner gets a summary stored with the document, with people by role and no citations', async () => {
    as('owner');
    for (const name of ['judgment', 'order', 'private'] as const) {
      expect(await run(docs[name])).toBe(`/documents/${docs[name]}/summary`);
    }
    const row = (
      await root.query(`SELECT summary, created_by FROM ai_summaries WHERE document_id = $1`, [docs.judgment])
    ).rows[0];
    expect(row).toEqual({
      summary: "The court allowed the plaintiff's application.\n• The defendant is to file a reply.",
      created_by: seed.a.members.owner.userId,
    });
  });

  it('who sees a summary follows who sees the document', async () => {
    expect(await visibleTo('owner', 'assigned', docs.private)).toBe(1);
    expect(await visibleTo('associate', 'all', docs.judgment)).toBe(1);
    expect(await visibleTo('associate', 'all', docs.private)).toBe(0); // P6
    expect(await visibleTo('associate', 'assigned', docs.judgment)).toBe(0); // P3
    expect(await visibleTo('munshi', 'all', docs.order)).toBe(1); // orders only (P5)
    expect(await visibleTo('munshi', 'all', docs.judgment)).toBe(0);
  });
});
