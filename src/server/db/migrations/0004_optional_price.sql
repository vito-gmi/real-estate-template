-- Optional, hideable price.
--
-- Hand-ordered after `drizzle-kit generate`: the generated columns below read
-- `show_price`, so it has to exist first, and dropping a generated column drops
-- every index on it, so those indexes are recreated at the end.
--
-- Listings that exist before this migration had a public price, so they start
-- with `show_price = true`; the column default then switches to false, which is
-- what every listing created from now on gets.
ALTER TABLE "listings" ADD COLUMN "show_price" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "show_price" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "listings" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
DROP INDEX "listings_price_sort_idx";--> statement-breakpoint
ALTER TABLE "listings" drop column "price_eur";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "price_eur" numeric(12, 2) GENERATED ALWAYS AS ((case when "listings"."show_price" then (case when "listings"."currency" = 'EUR' then "listings"."price" else round("listings"."price" / 1.95583, 2) end) end)) STORED;--> statement-breakpoint
ALTER TABLE "listings" drop column "price_per_sqm_eur";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "price_per_sqm_eur" numeric(12, 2) GENERATED ALWAYS AS ((case when "listings"."show_price" and coalesce("listings"."area", "listings"."land_area") > 0 then round((case when "listings"."currency" = 'EUR' then "listings"."price" else "listings"."price" / 1.95583 end) / coalesce("listings"."area", "listings"."land_area"), 2) end)) STORED;--> statement-breakpoint
ALTER TABLE "listings" drop column "sort_price_per_sqm";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "sort_price_per_sqm" numeric(12, 2) GENERATED ALWAYS AS ((case when "listings"."show_price" and coalesce("listings"."area", "listings"."land_area") > 0 then round((case when "listings"."currency" = 'EUR' then "listings"."price" else "listings"."price" / 1.95583 end) / coalesce("listings"."area", "listings"."land_area"), 2) else 999999999 end)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "sort_price_asc" numeric(12, 2) GENERATED ALWAYS AS ((case when "listings"."show_price" then (case when "listings"."currency" = 'EUR' then "listings"."price" else round("listings"."price" / 1.95583, 2) end) else 999999999 end)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "sort_price_desc" numeric(12, 2) GENERATED ALWAYS AS ((case when "listings"."show_price" then (case when "listings"."currency" = 'EUR' then "listings"."price" else round("listings"."price" / 1.95583, 2) end) else -1 end)) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "listings_facet_idx" ON "listings" USING btree ("status","deal_type","property_kind","city_id","price_eur");--> statement-breakpoint
CREATE INDEX "listings_ppsqm_sort_idx" ON "listings" USING btree ("status","deal_type","sort_price_per_sqm","id");--> statement-breakpoint
CREATE INDEX "listings_price_asc_sort_idx" ON "listings" USING btree ("status","deal_type","sort_price_asc","id");--> statement-breakpoint
CREATE INDEX "listings_price_desc_sort_idx" ON "listings" USING btree ("status","deal_type","sort_price_desc" desc,"id" desc);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_shown_price_present" CHECK (not "listings"."show_price" or "listings"."price" is not null);
