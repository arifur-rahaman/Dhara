/** Test database (a separate database, never the dev one). Override in CI with the TEST_DATABASE_* variables. */
export const testDb = {
  migrateUrl: process.env.TEST_DATABASE_MIGRATE_URL ?? 'postgresql://dhara:dhara@localhost:5432/dhara_test',
  appUrl: process.env.TEST_DATABASE_URL ?? 'postgresql://dhara_app:dhara_app@localhost:5432/dhara_test',
  adminUrl: process.env.TEST_DATABASE_ADMIN_URL ?? 'postgresql://dhara_admin:dhara_admin@localhost:5432/dhara_test',
};
