-- Hub user who created the PO (public.users). Legacy Shopify CSV rows keep importer NULL
-- unless they have legacy_external_id set (see backfill below).

ALTER TABLE "order"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;

-- All POs without legacy export id are treated as hub-created; backfill creator.
UPDATE "order"."purchase_orders"
SET "created_by_id" = 'cmnz4zp4j000039td9sx1gp5f'
WHERE "legacy_external_id" IS NULL;

CREATE INDEX IF NOT EXISTS "purchase_orders_created_by_id_idx"
  ON "order"."purchase_orders" ("created_by_id");

ALTER TABLE "order"."purchase_orders"
  ADD CONSTRAINT "purchase_orders_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "public"."users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
