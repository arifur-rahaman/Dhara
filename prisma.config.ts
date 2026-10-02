import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations run as the migration role. The app itself connects as the RLS-bound app role (DATABASE_URL).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.ts' },
  // process.env (not env()) so `prisma generate` also works where no database is configured, such as lint-only CI.
  datasource: { url: process.env.DATABASE_MIGRATE_URL ?? '' },
});
