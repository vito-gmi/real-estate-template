# Featured and exclusive listings

Every listing has two independent on/off switches in the admin form: **Featured listing** (BG: *Топ оферта*) and **Exclusive listing** (BG: *Ексклузивна оферта*). They look similar but answer different questions:

|                     | Featured                                          | Exclusive                                                       |
| ------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| Question it answers | "Do we want to **promote** this property?"        | "Are we the **only agency** allowed to sell or rent it?"        |
| Kind of decision    | Marketing choice, can change any day              | Fact from the contract with the owner                           |
| Who decides         | The agency, freely                                | Set by the signed agreement — switch it on only when one exists |
| Visible effect      | Home-page showcase + **Top** badge on cards       | **Exclusive** badge on the property's own page                  |

Both can be on at the same time, and neither changes the price, the search ranking, or who can see the listing. One exception: a featured or exclusive listing whose price is hidden still appears when a visitor filters by price (see [Price on request](price-on-request.md)).

## Featured listing — "promote this"

A featured listing is one the agency has chosen to put in the shop window.

**Where visitors see it**

- **Home page, "Featured properties" / "Топ предложения" section** — up to 6 featured listings, newest first.
- **"Top" badge** on the listing's card, wherever cards appear: search results, the home page, "similar properties", favourites and compare.

**Rules worth knowing**

- The home-page section needs **at least 3** featured listings. With fewer, it silently shows the 6 newest listings instead, under the same "Featured" heading.
- Only listings visitors can see count: status **Active** or **Reserved**. Featuring a draft, sold, rented or archived listing has no visible effect until it is active again.
- Featuring does **not** move a listing up in search results. Search order is always the sort the visitor picked (newest, price, area, price per m²).
- A "featured only" search exists as a link parameter (`?featured=1` on any search URL) but has no button in the filter panel.

**When to use it:** to give chosen properties more visibility — strong deals, new projects, listings a seller pays extra to promote. Keep it to a handful; if everything is featured, nothing stands out.

## Exclusive listing — "only through us"

On the Bulgarian market an *ексклузивна оферта* means the owner has signed an **exclusive agreement**: this agency is the only one marketing the property, so a buyer or tenant can only reach the owner through it. The website stores only a yes/no flag; this meaning comes from market practice and the agency's contracts, not from the software.

**Where visitors see it**

- An **"Exclusive" badge** at the top of the property's own detail page.

That is the only place it is shown. It is not shown on cards, cannot be filtered on, and does not affect the home page. It does keep a listing with a hidden price in price-filtered searches (see [Price on request](price-on-request.md)).

**When to use it:** only when a signed exclusive agreement exists. Marking a property exclusive without one misleads clients and other agents.

## How to set them

1. Open **Admin → Listings** and edit the listing (editor or admin role).
2. Switch **Featured listing** and/or **Exclusive listing** on or off.
3. Save. The public site updates on the next page load; CDN-cached pages may take up to about 5 minutes.

## Known limitations (as of 2026-11-21)

- **Badges are not translated.** The card badge always reads "Top" and the detail-page badge "Exclusive", in English, on both language versions (`src/features/listings/components/listing-card.tsx`, `src/features/listings/pages/detail-page.tsx`). The form labels are translated.
- **CSV import drops both flags.** Export includes them, but import always sets both to off, so an export → import round trip loses them (`src/features/admin/import-export.ts`).
- **Home-page fallback is invisible.** With fewer than 3 featured listings, visitors see "Featured properties" filled with ordinary newest listings.
- **Exclusive is barely visible in search.** No badge on cards and no filter; it only keeps a listing with a hidden price in price-filtered results.

## Technical reference

| Item                    | Featured                                                                 | Exclusive                                   |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| Database column         | `listings.is_featured` (boolean, default `false`)                        | `listings.is_exclusive` (boolean, default `false`) |
| Form / validation       | `isFeatured` in `src/features/admin/listing-schema.ts`                   | `isExclusive` in the same schema             |
| Read paths              | `getShowcaseListings({ featuredOnly })` in `src/server/repositories/listings.ts`; `featuredOnly` filter rule in `src/features/search/query-builder.ts` | Carried on the DTO only (`ListingCardDto.isExclusive`) |
| UI                      | Home page `src/app/[locale]/(public)/page.tsx`; card badge               | Detail-page badge                            |
| Index                   | Partial index `listings_featured_idx` (`is_featured` and `status = 'active'`) | none                                        |
| Translations (labels)   | `admin.fields.isFeatured`, `home.featuredTitle`, `home.featuredSubtitle` | `admin.fields.isExclusive`                   |
