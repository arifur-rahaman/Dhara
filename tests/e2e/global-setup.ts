import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { e2eEnv } from './env';

/** Fresh SMS outbox and migrated end-to-end database before the run. */
export default function setup() {
  mkdirSync('test-results', { recursive: true });
  writeFileSync(e2eEnv.SMS_OUTBOX_FILE, '');
  const env = { ...process.env, ...e2eEnv };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { env, stdio: 'pipe' });
  execFileSync('node', ['scripts/db-roles.mjs'], { env, stdio: 'pipe' });
  execFileSync('node', ['scripts/load-courses.mjs'], { env, stdio: 'pipe' });
}
