-- Add email tracking columns to purchase_orders.
-- These were added to the Prisma schema but had no corresponding migration,
-- causing P2022 "column not available" errors in production.
-- (shipping_address / billing_address / billing_same_as_shipping were already
--  added in 20260416000000_add_address_fields.)

ALTER TABLE "order"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "email_sent_at"        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "email_tracking_token" TEXT,
  ADD COLUMN IF NOT EXISTS "email_opened_at"      TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_email_tracking_token_key"
  ON "order"."purchase_orders" ("email_tracking_token")
  WHERE "email_tracking_token" IS NOT NULL;
