import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ctx } from '@/server/authz';
import { seedTwoChambers } from './fixtures';
import { testDb } from './test-env';

/**
 * Login codes by email and invitations without SMS (no SMS gateway yet). The server actions run for real;
 * only the request (cookies, headers) is simulated. Read before env() is first used in this file.
 */
const outbox = join(tmpdir(), `dhara-email-${randomUUID()}.jsonl`);
process.env.OTP_CHANNEL = 'email';
process.env.EMAIL_PROVIDER = 'file';
process.env.EMAIL_OUTBOX_FILE = outbox;
process.env.SMS_PROVIDER = 'none';

const req = vi.hoisted(() => ({ cookies: new Map<string, string>(), ctx: null as Ctx | null }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT ${url}`), { url });
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (req.cookies.has(name) ? { name, value: req.cookies.get(name)! } : undefined),
    set: (name: string, value: string) => void req.cookies.set(name, value),
    delete: (name: string) => void req.cookies.delete(name),
  }),
  headers: async () =>
    new Headers({ 'user-agent': 'test', 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.1` }),
}));
vi.mock('@/features/preferences/server', () => ({ getPreferences: async () => ({ locale: 'en', numerals: 'latn' }) }));
vi.mock('@/server/context', async (original) => ({
  ...(await original<typeof import('@/server/context')>()),
  requireCtx: async () => req.ctx!,
}));

const redirectOf = async (p: Promise<unknown>) => {
  try {
    const value = await p;
    return { value };
  } catch (e) {
    if (e instanceof Error && 'url' in e) return { url: (e as { url: string }).url };
    throw e;
  }
};
const lastCode = (to: string) => {
  const lines = readFileSync(outbox, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const mail = lines.reverse().find((m) => m.to === to);
  return mail ? (mail.text.match(/\d{6}/) as RegExpMatchArray)[0] : null;
};
const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};
const newPhone = () => `017${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

let seed: Awaited<ReturnType<typeof seedTwoChambers>>;
let root: pg.Client;

beforeAll(async () => {
  writeFileSync(outbox, '');
  seed = await seedTwoChambers();
  root = new pg.Client({ connectionString: testDb.migrateUrl });
  await root.connect();
});
afterAll(async () => {
  await root.end();
});
beforeEach(() => {
  req.cookies.clear();
});

async function signUpByEmail(local: string, email: string) {
  const { sendOtp, verifyCode } = await import('@/features/auth/actions');
  expect(await sendOtp(undefined, form({ phone: local }))).toEqual({ step: 'email', values: { phone: local } });
  const sent = await redirectOf(sendOtp(undefined, form({ phone: local, email })));
  const challenge = new URL(sent.url!, 'http://x').searchParams.get('c')!;
  return redirectOf(verifyCode(undefined, form({ challenge, code: lastCode(email.toLowerCase())! })));
}

describe('email sign-in codes (OTP_CHANNEL=email)', () => {
  it('a new number gives an email, gets the code there, and is created with that address (phone not proven)', async () => {
    const local = newPhone();
    const email = `New.Owner.${randomUUID().slice(0, 6)}@Example.org`;
    const done = await signUpByEmail(local, email);
    expect(done.url).toBe('/today');
    const user = (await root.query(`SELECT * FROM users WHERE phone = $1`, [`+88${local}`])).rows[0];
    expect(user.email).toBe(email.toLowerCase());
    expect(user.email_verified_at).not.toBeNull();
    expect(user.phone_verified_at).toBeNull();
    expect(req.cookies.has('dhara_session')).toBe(true);
  });

  it('a known number always gets the code at its saved address, whatever address is posted', async () => {
    const { sendOtp } = await import('@/features/auth/actions');
    const local = newPhone();
    const email = `known.${randomUUID().slice(0, 6)}@example.org`;
    await signUpByEmail(local, email);
    req.cookies.clear();
    const attacker = `attacker.${randomUUID().slice(0, 6)}@example.org`;
    const sent = await redirectOf(sendOtp(undefined, form({ phone: local, email: attacker })));
    expect(sent.url).toMatch(/^\/login\/verify\?c=/);
    const challenge = new URL(sent.url!, 'http://x').searchParams.get('c');
    const row = (await root.query(`SELECT email FROM otp_challenges WHERE id = $1`, [challenge])).rows[0];
    expect(row.email).toBe(email);
    expect(lastCode(attacker)).toBeNull();
  });

  it('a number that has an account but no email must use its password; no code is sent anywhere', async () => {
    const { sendOtp } = await import('@/features/auth/actions');
    const phone = (await root.query(`SELECT phone FROM users WHERE id = $1`, [seed.a.members.munshi.userId])).rows[0]
      .phone;
    const local = phone.replace('+88', '');
    const before = (await root.query(`SELECT count(*)::int AS n FROM otp_challenges WHERE phone = $1`, [phone])).rows[0]
      .n;
    expect(await sendOtp(undefined, form({ phone: local, email: 'someone@example.org' }))).toEqual({
      error: 'noEmailUsePassword',
      values: { phone: local },
    });
    const after = (await root.query(`SELECT count(*)::int AS n FROM otp_challenges WHERE phone = $1`, [phone])).rows[0]
      .n;
    expect(after).toBe(before);
  });

  it('an address already on another account is refused; a bad address is refused', async () => {
    const { sendOtp } = await import('@/features/auth/actions');
    const email = `taken.${randomUUID().slice(0, 6)}@example.org`;
    await signUpByEmail(newPhone(), email);
    const local = newPhone();
    expect(await sendOtp(undefined, form({ phone: local, email: email.toUpperCase() }))).toMatchObject({
      step: 'email',
      error: 'emailTaken',
    });
    expect(await sendOtp(undefined, form({ phone: local, email: 'not-an-email' }))).toMatchObject({
      step: 'email',
      error: 'emailInvalid',
    });
  });
});

describe('when the code cannot be sent', () => {
  it('the form says so and keeps what was typed, instead of failing the page', async () => {
    const { sendOtp } = await import('@/features/auth/actions');
    // Make the test outbox unwritable, as when the email service refuses or has no key.
    rmSync(outbox);
    mkdirSync(outbox);
    try {
      const local = `0171${String(Date.now()).slice(-7)}`;
      expect(await sendOtp(undefined, form({ phone: local, email: 'new-owner@example.org' }))).toEqual({
        error: 'sendFailed',
        step: 'email',
        values: { phone: local, email: 'new-owner@example.org' },
      });
    } finally {
      rmSync(outbox, { recursive: true });
      writeFileSync(outbox, '');
    }
  });
});

describe('invitations without SMS', () => {
  const asOwner = () => {
    req.ctx = {
      userId: seed.a.members.owner.userId,
      chamberId: seed.a.chamberId,
      membershipId: seed.a.members.owner.membershipId,
      role: 'owner',
      caseScope: 'all',
      canSeeFees: true,
    };
  };

  it('the owner gets the link to share; the database keeps only its hash; no SMS is attempted', async () => {
    const { inviteMember } = await import('@/features/team/actions');
    asOwner();
    const local = newPhone();
    const result = await inviteMember(undefined, form({ name: 'Link Invitee', phone: local, role: 'munshi' }));
    expect(result).toMatchObject({ ok: true, values: { name: 'Link Invitee', phone: `+88${local}` } });
    const token = result!.link!.split('/invite/')[1];
    expect(token).toMatch(/^[\w-]{20,100}$/);
    const rows = (await root.query(`SELECT token_hash FROM invitations WHERE phone = $1`, [`+88${local}`])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toContain(token);
  });

  it('without the link, an invitation is not found by an unproven phone', async () => {
    const { inviteMember, acceptInvitation } = await import('@/features/team/actions');
    asOwner();
    const local = newPhone();
    await inviteMember(undefined, form({ name: 'Squatter Target', phone: local, role: 'associate' }));
    const invitationId = (await root.query(`SELECT id FROM invitations WHERE phone = $1`, [`+88${local}`])).rows[0].id;
    // Someone signs up with that number by email (the phone is not proven) and tries to accept by id.
    req.cookies.clear();
    await signUpByEmail(local, `squatter.${randomUUID().slice(0, 6)}@example.org`);
    await root.query(`UPDATE users SET privacy_consent_at = now() WHERE phone = $1`, [`+88${local}`]);
    const r = await redirectOf(acceptInvitation(form({ invitationId })));
    expect(r.url).toBe('/onboarding');
    const n = (
      await root.query(
        `SELECT count(*)::int AS n FROM memberships m JOIN users u ON u.id = m.user_id WHERE u.phone = $1`,
        [`+88${local}`],
      )
    ).rows[0].n;
    expect(n).toBe(0);
  });

  it('an invitee without email joins with the link and a password, once; then accepts with the link', async () => {
    const { inviteMember, joinInviteWithPassword, acceptInvitation } = await import('@/features/team/actions');
    asOwner();
    const local = newPhone();
    const { link } = (await inviteMember(undefined, form({ name: 'Password Munshi', phone: local, role: 'munshi' })))!;
    const token = link!.split('/invite/')[1];
    req.cookies.clear();

    expect(await joinInviteWithPassword(undefined, form({ token, password: 'short' }))).toEqual({
      error: 'passwordShort',
    });
    expect(await joinInviteWithPassword(undefined, form({ token: 'x'.repeat(30), password: 'long enough 1' }))).toEqual(
      {
        error: 'inviteInvalid',
      },
    );
    const joined = await redirectOf(joinInviteWithPassword(undefined, form({ token, password: 'long enough 1' })));
    expect(joined.url).toBe(`/invite/${token}`);
    const user = (await root.query(`SELECT * FROM users WHERE phone = $1`, [`+88${local}`])).rows[0];
    expect(user.password_hash).toMatch(/^\$argon2id\$/);
    expect(user.phone_verified_at).toBeNull();

    // A second try for the same number is refused: it now has an account.
    expect(await joinInviteWithPassword(undefined, form({ token, password: 'long enough 1' }))).toEqual({
      error: 'accountExists',
    });

    await root.query(`UPDATE users SET privacy_consent_at = now() WHERE id = $1`, [user.id]);
    const accepted = await redirectOf(acceptInvitation(form({ token })));
    expect(accepted.url).toBe('/today');
    const m = (
      await root.query(`SELECT role FROM memberships WHERE user_id = $1 AND chamber_id = $2`, [
        user.id,
        seed.a.chamberId,
      ])
    ).rows;
    expect(m).toEqual([{ role: 'munshi' }]);
  });
});
