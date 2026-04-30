-- Hub-only inbox flag (not synced to Shopify).
ALTER TABLE "order"."shopify_orders"
ADD COLUMN IF NOT EXISTS "office_pending_at" TIMESTAMPTZ;
