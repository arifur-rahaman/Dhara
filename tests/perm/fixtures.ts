import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { testDb } from './test-env';

/**
 * Two chambers with every role (TECH_GUIDE section 20). Rows are inserted as the migration role,
 * which owns the tables and is a superuser in development, so RLS does not block the setup itself.
 */
export async function seedTwoChambers() {
  const db = new pg.Client({ connectionString: testDb.migrateUrl });
  await db.connect();
  const make = async (label: string) => {
    const chamberId = randomUUID();
    await db.query(`INSERT INTO chambers (id, name, district, updated_at) VALUES ($1, $2, 'Chattogram', now())`, [
      chamberId,
      `Chamber ${label}`,
    ]);
    const members: Record<'owner' | 'associate' | 'munshi' | 'staff', { userId: string; membershipId: string }> =
      {} as never;
    for (const role of ['owner', 'associate', 'munshi', 'staff'] as const) {
      const userId = randomUUID();
      const membershipId = randomUUID();
      const phone = `+88017${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
      await db.query(`INSERT INTO users (id, phone, name, updated_at) VALUES ($1, $2, $3, now())`, [
        userId,
        phone,
        role,
      ]);
      await db.query(
        `INSERT INTO memberships (id, chamber_id, user_id, role, updated_at) VALUES ($1, $2, $3, $4, now())`,
        [membershipId, chamberId, userId, role],
      );
      members[role] = { userId, membershipId };
    }
    const inviteId = randomUUID();
    await db.query(
      `INSERT INTO invitations (id, chamber_id, phone, name, role, token_hash, invited_by, expires_at, updated_at)
       VALUES ($1, $2, '+8801900000000', 'Invitee', 'munshi', $3, $4, now() + interval '7 days', now())`,
      [inviteId, chamberId, `hash-${inviteId}`, members.owner.userId],
    );
    await db.query(
      `INSERT INTO audit_log (id, chamber_id, actor_user_id, actor_kind, action, entity) VALUES ($1, $2, $3, 'member', 'chamber.create', 'chamber')`,
      [randomUUID(), chamberId, members.owner.userId],
    );
    return { chamberId, members, inviteId, inviteTokenHash: `hash-${inviteId}` };
  };
  const a = await make('A');
  const b = await make('B');
  await db.end();
  return { a, b };
}
