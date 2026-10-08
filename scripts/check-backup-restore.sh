#!/usr/bin/env bash
# Backup → restore round trip (F16 "done when: a restore from backup works"). Backs up SOURCE_URL,
# restores into a fresh database, and checks that every table has the same number of rows and that
# row-level security and its policies came back. Needs age, pg_dump/pg_restore (or PG_DUMP/PG_RESTORE).
set -euo pipefail
: "${SOURCE_URL:?set SOURCE_URL}"
: "${RESTORE_ADMIN_URL:?set RESTORE_ADMIN_URL}"
WORK=$(mktemp -d "${CHECK_WORK_DIR:-${TMPDIR:-/tmp}}/dhara-backup-check.XXXXXX")
trap 'rm -rf -- "$WORK"' EXIT
age-keygen -o "$WORK/key.txt" 2> /dev/null
RECIPIENT=$(grep -o 'age1[0-9a-z]*' "$WORK/key.txt" | head -1)
TARGET="dhara_restore_check_$$"
psql "$RESTORE_ADMIN_URL" -q -c "DROP DATABASE IF EXISTS $TARGET" > /dev/null

BACKUP_DATABASE_URL="$SOURCE_URL" BACKUP_AGE_RECIPIENT="$RECIPIENT" BACKUP_DIR="$WORK/out" bash "$(dirname "$0")/backup.sh" > /dev/null
FILE=$(ls "$WORK"/out/dhara-*.tar.age)
if age --decrypt --identity /dev/null "$FILE" > /dev/null 2>&1; then echo "backup is not encrypted"; exit 1; fi
BACKUP_AGE_IDENTITY="$WORK/key.txt" bash "$(dirname "$0")/restore.sh" "$FILE" "$TARGET" > /dev/null
TARGET_URL="${RESTORE_ADMIN_URL%/*}/$TARGET"

summary() {
  psql "$1" -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT string_agg(format('%s=%s', t.relname, t.n), ',' ORDER BY t.relname) FROM (
  SELECT c.relname, (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I', c.relname), false, true, '')))[1]::text AS n
  FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relname <> '_prisma_migrations') t;
SELECT count(*) FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
  WHERE s.nspname = 'public' AND c.relrowsecurity AND c.relforcerowsecurity;
SELECT count(*) FROM pg_policies WHERE schemaname = 'public';
SQL
}
BEFORE=$(summary "$SOURCE_URL")
AFTER=$(summary "$TARGET_URL")
psql "$RESTORE_ADMIN_URL" -q -c "DROP DATABASE $TARGET" > /dev/null
if [ "$BEFORE" != "$AFTER" ]; then
  echo "restore differs from source"; diff <(echo "$BEFORE" | tr ',' '\n') <(echo "$AFTER" | tr ',' '\n') || true; exit 1
fi
echo "backup and restore round trip OK ($(echo "$BEFORE" | head -1 | tr ',' '\n' | wc -l) tables, RLS and policies intact)"
