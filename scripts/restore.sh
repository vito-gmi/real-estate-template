#!/usr/bin/env bash
set -euo pipefail

# Restore a dump produced by scripts/backup.sh.
#
# Usage:
#   DATABASE_URL=postgres://… ./scripts/restore.sh .backups/estate-YYYYMMDD.sql.gz
#
# This DROPS and recreates the public schema. Never point it at production
# without an explicit confirmation — the script refuses to run against a URL
# that does not contain "localhost" or "127.0.0.1" unless CONFIRM_RESTORE=yes.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL is required}"
DUMP="${1:?path to .sql.gz dump required}"

if [[ "$DATABASE_URL" != *localhost* && "$DATABASE_URL" != *127.0.0.1* && "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Refusing to restore to a remote database. Set CONFIRM_RESTORE=yes to override." >&2
  exit 1
fi

echo "Restoring $DUMP into $DATABASE_URL"
gzip -dc "$DUMP" | psql --single-transaction --set ON_ERROR_STOP=1 "$DATABASE_URL"
echo "Restore complete."
