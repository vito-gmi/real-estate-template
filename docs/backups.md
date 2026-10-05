# Backups and restore drill

Listings, inquiries and the audit log live in Postgres. Object storage (R2 / local disk) is a separate backup — photographs are content-hashed and can be re-uploaded, but a lost bucket is still a bad day.

## Nightly dump

```bash
chmod +x scripts/backup.sh scripts/restore.sh
DATABASE_URL=postgres://… ./scripts/backup.sh
```

The script writes a gzipped plain-SQL dump to `.backups/estate-<timestamp>.sql.gz` and keeps the newest 14 files. Point cron (or a GitHub Action on a schedule) at it:

```
15 2 * * * cd /opt/estate && ./scripts/backup.sh /var/backups/estate
```

Copy the dumps off the box. A backup that lives next to the database is not a backup.

## Restore drill (run this quarterly)

1. Stand up a throwaway Postgres (`docker compose up -d postgres`).
2. Restore the latest dump:

   ```bash
   DATABASE_URL=postgres://estate:estate@localhost:5433/estate \
     ./scripts/restore.sh .backups/estate-YYYYMMDDT….sql.gz
   ```

3. Confirm: `npm run db:studio` or `psql` — listing count matches, a known reference id exists, an inquiry from last week is present.
4. Hit `/en/for-sale` against a locally running app pointed at the restored database. If ISR still has old HTML, that is expected; the origin is what you are testing.
5. Record the date of the drill in your runbook. `scripts/restore.sh` refuses remote URLs unless `CONFIRM_RESTORE=yes`, so production restores are deliberate.

## What this does not cover

- R2 / S3: enable object-lock or bucket replication in the provider console.
- Neon: PITR is available on paid plans and is the faster production recovery path. The dump is the portable, provider-independent copy.
