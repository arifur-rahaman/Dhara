#!/usr/bin/env bash
# Encrypted backup (F16, TECH_GUIDE section 12 "backup.daily"). Run nightly from the host's scheduler.
#   BACKUP_DATABASE_URL  database to dump (the migration/owner role)
#   BACKUP_AGE_RECIPIENT age public key (age1...); only the matching private key can read the backup
#   BACKUP_DIR           where encrypted files go (sync this folder off the server)
#   BACKUP_KEEP          how many backups to keep (default 14)
#   STORAGE_PROVIDER / STORAGE_DIR  with "local", the file store is archived too. With S3, use bucket
#                        versioning plus replication to a second region or account instead.
# The pg-boss queue schema is left out: it holds only transient jobs and is recreated on restore.
set -euo pipefail
: "${BACKUP_DATABASE_URL:?set BACKUP_DATABASE_URL}"
: "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT (age public key)}"
: "${BACKUP_DIR:?set BACKUP_DIR}"
PG_DUMP=${PG_DUMP:-pg_dump}
KEEP=${BACKUP_KEEP:-14}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$BACKUP_DIR"
WORK=$(mktemp -d "$BACKUP_DIR/.work.XXXXXX")
trap 'rm -rf -- "$WORK"' EXIT

$PG_DUMP --format=custom --no-owner --exclude-schema=pgboss --file="$WORK/db.dump" "$BACKUP_DATABASE_URL"
if [ "${STORAGE_PROVIDER:-}" = "local" ] && [ -d "${STORAGE_DIR:-}" ]; then
  tar -C "$STORAGE_DIR" -cf "$WORK/files.tar" .
fi
tar -C "$WORK" -cf - . | age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$BACKUP_DIR/dhara-$STAMP.tar.age"
echo "backup written: $BACKUP_DIR/dhara-$STAMP.tar.age"

# Keep the newest $KEEP backups.
ls -1t "$BACKUP_DIR"/dhara-*.tar.age 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do rm -f -- "$old"; done
