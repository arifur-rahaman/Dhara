// Gives the database roles created by the migrations a LOGIN and password.
// Passwords come from DATABASE_URL (dhara_app) and DATABASE_ADMIN_URL (dhara_admin); runs as the migration role.
// Usage: node --env-file=.env scripts/db-roles.mjs
import pg from 'pg';

const roles = [
  ['DATABASE_URL', 'dhara_app'],
  ['DATABASE_ADMIN_URL', 'dhara_admin'],
];

const client = new pg.Client({ connectionString: process.env.DATABASE_MIGRATE_URL });
await client.connect();
for (const [variable, role] of roles) {
  const url = process.env[variable];
  if (!url) throw new Error(`${variable} is not set`);
  const { username, password } = new URL(url);
  if (username !== role) throw new Error(`${variable} must connect as ${role}`);
  // Identifiers are fixed above; the password is passed as a literal via format().
  const { rows } = await client.query('SELECT format($1, $2::text) AS sql', [
    `ALTER ROLE ${role} LOGIN PASSWORD %L`,
    decodeURIComponent(password),
  ]);
  await client.query(rows[0].sql);
  console.log(`${role}: login enabled`);
}
await client.end();
