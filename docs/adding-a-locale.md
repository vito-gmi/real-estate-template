# Adding a locale

The site ships with `bg` and `en`. A third language is a routing change plus a message file, not a rewrite.

1. **Routing** — add the code to `locales` in `src/i18n/routing.ts` and to `localeTags` (BCP 47 tag used in `lang` and `hreflang`).
2. **Messages** — copy `messages/en.json` to `messages/<code>.json` and translate. Keep the keys identical; next-intl fails loud on a missing key in development.
3. **URL segments** — translated path prefixes live in `src/lib/routes.ts` (`staticRouteSlugs`) and in `src/lib/domain/enums.ts` (`dealTypeSlugs`, `propertyKindSlugs`). Add a column for the new locale in each map.
4. **Database** — `listing_translations.locale` is a Postgres enum. Extend it in `src/server/db/schema/enums.ts`, generate a migration, backfill a row per existing listing (title can start as a copy of English).
5. **Admin form** — `src/features/admin/components/listing-form.tsx` currently has explicit BG/EN fields. Duplicate the pair for the new locale and extend `listingFormSchema`.
6. **Sitemaps / feeds** — they iterate `routing.locales`, so they pick the new language up once the translations exist.

`src/config/site.ts` does not list locales; routing is the source of truth so a fork cannot advertise a language the app cannot serve.
