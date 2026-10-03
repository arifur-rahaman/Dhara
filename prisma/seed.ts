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
  await seedCases();
  await db.query('COMMIT');

  async function seedCases() {
    const chamber = await db.query(`SELECT id FROM chambers WHERE name = 'খান ল চেম্বার' LIMIT 1`);
    const chamberId = chamber.rows[0].id;
    if ((await db.query('SELECT 1 FROM cases WHERE chamber_id = $1 LIMIT 1', [chamberId])).rowCount) return;
    const member = async (role: string) =>
      (
        await db.query('SELECT m.id, m.user_id FROM memberships m WHERE m.chamber_id = $1 AND m.role = $2 LIMIT 1', [
          chamberId,
          role,
        ])
      ).rows[0];
    const owner = await member('owner');
    const associate = await member('associate');
    const court = async (nameEn: string, district: string | null) =>
      (
        await db.query(
          'SELECT id FROM courts WHERE name_en = $1 AND district IS NOT DISTINCT FROM $2 AND chamber_id IS NULL',
          [nameEn, district],
        )
      ).rows[0].id;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
    const plus = (days: number) => {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    };
    // Fictional sample data from the designs (plan.md section 5).
    const cases = [
      {
        client: 'মোঃ করিম হোসেন',
        type: 'civil',
        number: '245',
        court: await court('Joint District Judge Court', 'Chattogram'),
        courtNo: '2',
        assignee: associate.id,
        dates: [
          [plus(-14), 'বাদীর সময়ের আবেদন মঞ্জুর'],
          [plus(16), null],
        ],
        serial: null,
      },
      {
        client: 'মোঃ করিম হোসেন',
        type: 'writ',
        number: '1102',
        court: await court('High Court Division', null),
        courtNo: '18',
        assignee: owner.id,
        dates: [[plus(0), null]],
        serial: '45',
      },
      {
        client: 'সালমা বেগম',
        type: 'criminal_cr',
        number: '88',
        court: await court('Chief Metropolitan Magistrate Court', 'Chattogram'),
        courtNo: null,
        assignee: owner.id,
        dates: [[plus(0), null]],
        serial: '7',
      },
      {
        client: 'নূর আলম',
        type: 'civil',
        number: '310',
        court: await court('Joint District Judge Court', 'Chattogram'),
        courtNo: '2',
        assignee: associate.id,
        dates: [[plus(0), null]],
        serial: '31',
      },
      {
        client: 'রুমানা আক্তার',
        type: 'family',
        number: '56',
        court: await court('Family Court', 'Chattogram'),
        courtNo: null,
        assignee: owner.id,
        dates: [[plus(5), null]],
        serial: null,
      },
    ];
    const clientIds = new Map<string, string>();
    for (const c of cases) {
      let clientId = clientIds.get(c.client);
      if (!clientId) {
        clientId = randomUUID();
        await db.query(
          'INSERT INTO clients (id, chamber_id, display_name, created_by, updated_at) VALUES ($1, $2, $3, $4, now())',
          [clientId, chamberId, c.client, owner.user_id],
        );
        clientIds.set(c.client, clientId);
      }
      const caseId = randomUUID();
      await db.query(
        `INSERT INTO cases (id, chamber_id, type, number, year, court_id, court_no, our_side, client_id, assignee_membership_id, created_by, updated_at)
         VALUES ($1, $2, $3, $4, '2026', $5, $6, 'plaintiff', $7, $8, $9, now())`,
        [caseId, chamberId, c.type, c.number, c.court, c.courtNo, clientId, c.assignee, owner.user_id],
      );
      for (const [date, note] of c.dates) {
        await db.query(
          `INSERT INTO hearings (id, chamber_id, case_id, date, serial_or_item, outcome_note, added_by, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
          [randomUUID(), chamberId, caseId, date, date === today ? c.serial : null, note, owner.user_id],
        );
      }
    }
    console.log(`Demo cases added (${cases.length}).`);
  }
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}
