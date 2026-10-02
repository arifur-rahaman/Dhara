// Demo data for local development and staging only (plan.md section 11). Names are fictional (from the designs).
// Run: pnpm db:seed  — then sign in with OTP; codes print in the dev server console.
import { randomUUID } from 'node:crypto';
import pg from 'pg';

if (process.env.NODE_ENV === 'production') throw new Error('Seed data is for local and staging only');

const url = process.env.DATABASE_MIGRATE_URL;
if (!url) throw new Error('DATABASE_MIGRATE_URL is not set');

const people = [
  { phone: '+8801700000001', name: 'অ্যাড. সাইফুল খান', role: 'owner' },
  { phone: '+8801700000002', name: 'নুসরাত জাহান', role: 'associate' },
  { phone: '+8801700000003', name: 'আবদুল মালেক', role: 'munshi' },
  { phone: '+8801700000004', name: 'রফিকুল ইসলাম', role: 'staff' },
] as const;

const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  await db.query('BEGIN');
  const existing = await db.query(`SELECT id FROM chambers WHERE name = 'খান ল চেম্বার' LIMIT 1`);
  if (existing.rowCount) {
    console.log('Demo chamber already exists; nothing to do.');
  } else {
    const chamberId = randomUUID();
    await db.query(
      `INSERT INTO chambers (id, name, district, updated_at, trial_ends_at) VALUES ($1, 'খান ল চেম্বার', 'Chattogram', now(), now() + interval '30 days')`,
      [chamberId],
    );
    for (const p of people) {
      const user = await db.query(
        `INSERT INTO users (id, phone, name, privacy_consent_at, privacy_consent_version, updated_at)
         VALUES ($1, $2, $3, now(), 'seed', now())
         ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [randomUUID(), p.phone, p.name],
      );
      await db.query(
        `INSERT INTO memberships (id, chamber_id, user_id, role, case_scope, updated_at) VALUES ($1, $2, $3, $4, $5, now())`,
        [randomUUID(), chamberId, user.rows[0].id, p.role, p.role === 'associate' ? 'assigned' : 'all'],
      );
    }
    console.log('Demo chamber created. Sign in with OTP as:');
    for (const p of people) console.log(`  ${p.role.padEnd(9)} 0${p.phone.slice(4)}`);
  }
  await db.query('COMMIT');
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}
