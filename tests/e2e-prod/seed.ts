import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import type { BrowserContext } from '@playwright/test';
import { prodEnv } from './env';

/** A chamber with one munshi and one case heard today, signed in on the given browser context. */
export async function seedMunshiWithHearingToday(context: BrowserContext, baseURL: string) {
  const db = new pg.Client({ connectionString: prodEnv.DATABASE_MIGRATE_URL });
  await db.connect();
  const user = randomUUID();
  const chamber = randomUUID();
  const caseId = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  await db.query(
    `INSERT INTO users (id, phone, name, privacy_consent_at, privacy_consent_version, updated_at)
     VALUES ($1, $2, 'Offline Munshi', now(), '1', now())`,
    [user, `+88018${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`],
  );
  await db.query(
    `INSERT INTO chambers (id, name, district, updated_at) VALUES ($1, 'Offline Chamber', 'Chattogram', now())`,
    [chamber],
  );
  await db.query(
    `INSERT INTO memberships (id, chamber_id, user_id, role, updated_at) VALUES ($1, $2, $3, 'munshi', now())`,
    [randomUUID(), chamber, user],
  );
  const court = (await db.query(`SELECT id FROM courts WHERE chamber_id IS NULL AND level = 'district' LIMIT 1`))
    .rows[0].id;
  await db.query(
    `INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, created_by, updated_at)
     VALUES ($1, $2, 'civil', '245', '2026', $3, 'plaintiff', $4, now())`,
    [caseId, chamber, court, user],
  );
  await db.query(
    `INSERT INTO hearings (id, chamber_id, case_id, date, added_by, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
    [randomUUID(), chamber, caseId, today, user],
  );
  await db.query(
    `INSERT INTO sessions (id, token_hash, user_id, active_chamber_id, mfa_verified_at, expires_at)
     VALUES ($1, $2, $3, $4, now(), now() + interval '1 day')`,
    [randomUUID(), createHash('sha256').update(token).digest('base64url'), user, chamber],
  );
  await db.end();
  await context.addCookies([{ name: 'dhara_session', value: token, url: baseURL }]);
  return {
    caseId,
    today,
    async hearings() {
      const c = new pg.Client({ connectionString: prodEnv.DATABASE_MIGRATE_URL });
      await c.connect();
      const { rows } = await c.query(
        `SELECT to_char(date, 'YYYY-MM-DD') AS date, outcome_note FROM hearings WHERE case_id = $1 ORDER BY date`,
        [caseId],
      );
      await c.end();
      return rows as { date: string; outcome_note: string | null }[];
    },
  };
}
