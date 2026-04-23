-- Add indexes on purchase_orders for faster filtering queries.
-- archivedAt: used in WHERE archivedAt IS NULL / IS NOT NULL (active vs archived split)
-- expectedDate: used in ORDER BY and period filtering

CREATE INDEX IF NOT EXISTS "purchase_orders_archived_at_idx"
  ON "order"."purchase_orders" ("archived_at");

CREATE INDEX IF NOT EXISTS "purchase_orders_expected_date_idx"
  ON "order"."purchase_orders" ("expected_date");
