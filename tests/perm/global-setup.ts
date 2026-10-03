import { execFileSync } from 'node:child_process';
import { testDb } from './test-env';

/** Applies migrations to the test database and enables the app role's login. */
export default function setup() {
  const env = {
    ...process.env,
    DATABASE_MIGRATE_URL: testDb.migrateUrl,
    DATABASE_URL: testDb.appUrl,
    DATABASE_ADMIN_URL: testDb.adminUrl,
  };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { env, stdio: 'pipe' });
  execFileSync('node', ['scripts/db-roles.mjs'], { env, stdio: 'pipe' });
}
