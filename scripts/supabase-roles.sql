-- Run once in the Supabase SQL editor (as postgres) before the first `pnpm db:migrate`.
-- Supabase's postgres user is not a superuser. This creates Dhara's three roles and lets postgres act
-- for them, exactly as scripts/check-nonsuper-migrate.sh sets up the owner that CI tests on every change.
-- Passwords are set later by `pnpm db:migrate` (scripts/db-roles.mjs), from the connection strings.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_app') THEN
    CREATE ROLE dhara_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_admin') THEN
    CREATE ROLE dhara_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_jobs') THEN
    CREATE ROLE dhara_jobs NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
GRANT dhara_app, dhara_admin, dhara_jobs TO postgres WITH ADMIN OPTION;
