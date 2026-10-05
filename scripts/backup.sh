#!/usr/bin/env bash
set -euo pipefail

# Logical backup of the Postgres catalog.
#
# Usage:
#   DATABASE_URL=postgres://… ./scripts/backup.sh
#   ./scripts/backup.sh /path/to/backups
#
# Restore with scripts/restore.sh. Run this nightly from cron or a CI schedule
# and keep at least 7 daily copies — the restore drill in docs/backups.md
# assumes that.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

DEST="${1:-"$ROOT/.backups"}"
mkdir -p "$DEST"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DEST/estate-$STAMP.sql.gz"

echo "Backing up to $FILE"
pg_dump --no-owner --no-acl --format=plain "$DATABASE_URL" | gzip -9 > "$FILE"

# Keep the last 14 dumps in the default directory.
if [[ "$DEST" == "$ROOT/.backups" ]]; then
  ls -1t "$DEST"/estate-*.sql.gz | tail -n +15 | xargs -r rm --
fi

echo "Done. $(du -h "$FILE" | cut -f1)"
