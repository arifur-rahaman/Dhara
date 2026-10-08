#!/usr/bin/env bash
# Restores an encrypted backup into a NEW, empty database (F16). Never restores over a live database.
#   restore.sh <backup.tar.age> <target database name>
#   RESTORE_ADMIN_URL   connection with rights to create databases and roles (e.g. postgres://.../postgres)
#   BACKUP_AGE_IDENTITY path to the age private key file
#   RESTORE_STORAGE_DIR optional: where to unpack the archived file store (local storage only)
# Afterwards run scripts/db-roles.mjs against the new database to give the app roles their passwords.
set -euo pipefail
BACKUP=${1:?usage: restore.sh <backup.tar.age> <target database>}
TARGET=${2:?usage: restore.sh <backup.tar.age> <target database>}
: "${RESTORE_ADMIN_URL:?set RESTORE_ADMIN_URL}"
: "${BACKUP_AGE_IDENTITY:?set BACKUP_AGE_IDENTITY (age private key file)}"
PG_RESTORE=${PG_RESTORE:-pg_restore}
[[ "$TARGET" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "target database name must be lowercase letters, digits, _"; exit 1; }
WORK=$(mktemp -d)
trap 'rm -rf -- "$WORK"' EXIT

age --decrypt --identity "$BACKUP_AGE_IDENTITY" "$BACKUP" | tar -C "$WORK" -xf -

EXISTS=$(psql "$RESTORE_ADMIN_URL" -Atc "SELECT 1 FROM pg_database WHERE datname = '$TARGET'")
[ -z "$EXISTS" ] || { echo "database $TARGET already exists; restore only into a new database"; exit 1; }
psql "$RESTORE_ADMIN_URL" -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_app') THEN CREATE ROLE dhara_app NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_admin') THEN CREATE ROLE dhara_admin NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dhara_jobs') THEN CREATE ROLE dhara_jobs NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
END \$\$;
CREATE DATABASE $TARGET;
SQL
TARGET_URL="${RESTORE_ADMIN_URL%/*}/$TARGET"
$PG_RESTORE --no-owner --exit-on-error --dbname="$TARGET_URL" "$WORK/db.dump"
# The job queue schema is not in the backup; the worker fills it again on start.
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -q -c "CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION dhara_jobs"
if [ -f "$WORK/files.tar" ] && [ -n "${RESTORE_STORAGE_DIR:-}" ]; then
  mkdir -p "$RESTORE_STORAGE_DIR" && tar -C "$RESTORE_STORAGE_DIR" -xf "$WORK/files.tar"
fi
echo "restored into $TARGET"
