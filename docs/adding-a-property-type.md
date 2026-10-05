# Adding a property type

Property kinds are a closed vocabulary shared by the database, the validators, the URLs and the translations. Adding one is a four-step change.

1. **Domain enum** — append the machine key to `propertyKinds` in `src/lib/domain/enums.ts`. Add its URL slugs to `propertyKindSlugs` (Bulgarian and English).
2. **Database** — Drizzle builds the Postgres enum from that array. Generate a migration (`npm run db:generate`) and apply it (`npm run db:migrate`). Existing rows are untouched.
3. **Translations** — add `enums.propertyKind.<key>` and `enums.propertyKindPlural.<key>` in `messages/bg.json` and `messages/en.json`.
4. **Seed / filters** — if the kind should appear in demo data, mention it in `src/server/db/seed.ts`. Faceted search and the admin form pick up the new value automatically because they iterate `propertyKinds`.

Do not add a boolean column for a one-off amenity. That is what the `features` taxonomy is for — agents can add "gated complex" from `/admin/taxonomy` without a deploy.
