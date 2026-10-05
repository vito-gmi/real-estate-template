-- Objects that Drizzle's schema DSL cannot express, applied after every migration.
-- Everything here is idempotent so it can run on every deploy.

-- ---------------------------------------------------------------------------
-- Facet counts
--
-- Rendering "Apartments (243)" next to a filter must not cost a COUNT(*) over
-- the listings table on every page view. This view pre-aggregates the publicly
-- visible listings down to a few thousand rows; the application then sums the
-- slice it needs, which is a constant-time operation regardless of catalogue
-- size. It is refreshed whenever a listing's visibility changes, and on a cron.
-- ---------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS listing_facet_counts AS
SELECT
  deal_type,
  property_kind,
  region_id,
  city_id,
  location_id,
  count(*)::int AS listing_count
FROM listings
WHERE status IN ('active', 'reserved')
GROUP BY deal_type, property_kind, region_id, city_id, location_id;

-- REFRESH ... CONCURRENTLY requires a unique index. NULLs are coalesced because
-- PostgreSQL treats NULLs as distinct in unique indexes before version 15.
CREATE UNIQUE INDEX IF NOT EXISTS listing_facet_counts_key
  ON listing_facet_counts (
    deal_type,
    property_kind,
    coalesce(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(city_id, '00000000-0000-0000-0000-000000000000'::uuid),
    location_id
  );

CREATE INDEX IF NOT EXISTS listing_facet_counts_deal_idx
  ON listing_facet_counts (deal_type, property_kind);

-- ---------------------------------------------------------------------------
-- Reference-number search
--
-- Agents paste "100427" or "ID 100427" into the search box, so the reference
-- needs a text-shaped index in addition to its numeric unique index.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS listings_reference_text_idx
  ON listings USING gin ((reference::text) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Refresh helper. SECURITY DEFINER is deliberately not used: the application
-- role owns the view, and giving it more rights than that buys nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_listing_facet_counts() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY listing_facet_counts;
EXCEPTION
  -- A view that has never been populated cannot be refreshed concurrently.
  WHEN object_not_in_prerequisite_state THEN
    REFRESH MATERIALIZED VIEW listing_facet_counts;
END;
$$ LANGUAGE plpgsql;
