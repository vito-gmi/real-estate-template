-- Extensions the generated migrations depend on.
-- Applied before Drizzle's migration files so index definitions can reference them.

-- Trigram matching powers typo-tolerant title and reference lookups.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
