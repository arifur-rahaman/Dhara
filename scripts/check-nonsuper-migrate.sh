#!/usr/bin/env bash
# Applies every migration as a NON-superuser table owner (as on managed Postgres) and smoke-tests the
# SECURITY DEFINER functions there. Superusers skip row-level security, so development and the main test
# database cannot catch policies that block the owner itself.
# Needs SUPERUSER_URL (to create the owner role and database) and the app/admin/jobs roles to exist already.
set -euo pipefail
: "${SUPERUSER_URL:?set SUPERUSER_URL}"
HOST_URL="${SUPERUSER_URL%/*}"
DB=dhara_nonsuper_check
psql "$SUPERUSER_URL" -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_owner') THEN
    CREATE ROLE dhara_owner LOGIN PASSWORD 'dhara_owner' NOSUPERUSER CREATEROLE CREATEDB NOBYPASSRLS;
  END IF;
END \$\$;
GRANT dhara_app, dhara_admin, dhara_jobs TO dhara_owner WITH ADMIN OPTION, SET TRUE;
DROP DATABASE IF EXISTS $DB;
CREATE DATABASE $DB OWNER dhara_owner;
SQL
OWNER_URL="${HOST_URL/\/\/*@/\/\/dhara_owner:dhara_owner@}/$DB"
DATABASE_MIGRATE_URL="$OWNER_URL" pnpm exec prisma migrate deploy > /dev/null
DATABASE_MIGRATE_URL="$OWNER_URL" node scripts/load-courses.mjs > /dev/null
echo "migrations applied and courses loaded as a non-superuser owner"

psql "$OWNER_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
INSERT INTO users (id, phone, name, updated_at) VALUES ('00000000-0000-7000-8000-000000000001', '+8801700000099', 'Owner', now());
INSERT INTO chambers (id, name, district, updated_at) VALUES ('00000000-0000-7000-8000-0000000000c1', 'Check', 'Chattogram', now());
INSERT INTO memberships (id, chamber_id, user_id, role, updated_at)
  VALUES ('00000000-0000-7000-8000-0000000000a1', '00000000-0000-7000-8000-0000000000c1', '00000000-0000-7000-8000-000000000001', 'owner', now());
INSERT INTO cases (id, chamber_id, type, number, year, court_id, our_side, created_by, updated_at)
  SELECT '00000000-0000-7000-8000-0000000000e1', '00000000-0000-7000-8000-0000000000c1', 'civil', '1', '2026', id, 'plaintiff',
         '00000000-0000-7000-8000-000000000001', now() FROM courts WHERE chamber_id IS NULL LIMIT 1;
INSERT INTO hearings (id, chamber_id, case_id, date, added_by, updated_at)
  VALUES (gen_random_uuid(), '00000000-0000-7000-8000-0000000000c1', '00000000-0000-7000-8000-0000000000e1', DATE '2026-01-02',
          '00000000-0000-7000-8000-000000000001', now());
INSERT INTO platform_admins (id, phone, name, role, password_hash, totp_secret_enc, updated_at)
  VALUES ('00000000-0000-7000-8000-0000000000d1', '+8801900000099', 'Admin', 'support', 'x', 'x', now());
INSERT INTO sessions (id, token_hash, user_id, expires_at)
  VALUES ('00000000-0000-7000-8000-0000000000f1', 'check', '00000000-0000-7000-8000-000000000001', now() + interval '1 day');
SET ROLE dhara_app;
BEGIN;
SELECT set_config('app.user_id', '00000000-0000-7000-8000-000000000001', true);
SELECT app_claim_push_endpoint('https://push.example/check', 'p256dh-key-0000', 'auth-key-000', 'ua',
                               '00000000-0000-7000-8000-0000000000f1');
INSERT INTO course_progress (user_id, module_id) VALUES ('00000000-0000-7000-8000-000000000001', 'basic-computer-1');
COMMIT;
RESET ROLE;
SET ROLE dhara_jobs;
DO $$ BEGIN
  IF (SELECT count(*) FROM jobs_claim_reminders('night', '20:00', DATE '2026-01-01')) <> 1 THEN RAISE EXCEPTION 'reminder not claimed'; END IF;
  IF (SELECT count(*) FROM jobs_claim_reminders('night', '20:00', DATE '2026-01-01')) <> 0 THEN RAISE EXCEPTION 'reminder claimed twice'; END IF;
END $$;
RESET ROLE;
SET ROLE dhara_admin;
BEGIN;
SELECT set_config('app.admin_id', '00000000-0000-7000-8000-0000000000d1', true);
SELECT admin_request_support('00000000-0000-7000-8000-0000000000c1', 'Owner reported a problem') IS NOT NULL;
COMMIT;
RESET ROLE;
SQL
echo "definer functions work for a non-superuser owner"
