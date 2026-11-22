# Price on request

A listing's price is optional and **hidden by default**. Until an agent sets and shows a price, visitors see **"Price on request"** (BG: *Цена при запитване*) wherever the price would be.

## In the admin form

The price sits on the **Basics** tab and has three states:

| State                     | What the agent sees                                  | What visitors see  |
| ------------------------- | ---------------------------------------------------- | ------------------ |
| No price (the default)    | "Not set" and a **Set price** button                 | Price on request   |
| Price shown               | Price and currency inputs and a **Hide price** button | The price         |
| Price hidden, but stored  | The stored amount, "hidden from visitors", and a **Show price** button | Price on request |

- **Set price** opens the inputs. A shown price must be greater than zero.
- **Hide price** keeps the amount. **Show price** brings it back, ready to edit.
- Nothing changes on the public site until the listing is saved.
- The listings table and dashboard show a hidden price greyed out with a crossed-out eye icon, or "—" when there is none.

## On the public site

- Cards, the property page, compare, the social preview image and the RSS feed say "Price on request". The property page also hides the mortgage calculator and the price per m².
- A hidden price is never sent to the browser: not in the page, not in its data, and not in the structured data for search engines (the offer has no `price`).
- **Price filter:** a listing without a public price is left out when a visitor filters by price, **unless it is featured or exclusive**. Those stay in every price-filtered search, whatever amount is stored.
- **Price sort:** listings without a public price come last, in both "low to high" and "high to low".
- **Similar properties:** compared by price when the listing shows one, otherwise the newest matches are shown.

## Import and export

Exports include a `showPrice` column (CSV) or field (JSON). On import, a file without it, or a blank CSV cell, shows the price when there is one, so files exported before this feature keep their prices public. `price` is no longer a required CSV column.

## Technical reference

| Item                | Where                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| Columns             | `listings.price` (nullable), `listings.show_price` (boolean, default `false`); check constraint `listings_shown_price_present` |
| Public price columns | `price_eur`, `price_per_sqm_eur` are null when hidden; `sort_price_asc`, `sort_price_desc`, `sort_price_per_sqm` hold sentinels so hidden prices sort last (`src/server/db/schema/listings.ts`) |
| Migration           | `0004_optional_price.sql`: existing listings keep `show_price = true`                  |
| DTO boundary        | `toPrice` in `src/features/listings/mappers.ts`; `ListingCardDto.price` is `null` when hidden |
| Price filter        | `price` rule in `src/features/search/query-builder.ts`                                 |
| Admin control       | `PriceFields` in `src/features/admin/components/listing-form.tsx`                      |
| Translations        | `listing.priceOnRequest`, `admin.price.*`                                              |
