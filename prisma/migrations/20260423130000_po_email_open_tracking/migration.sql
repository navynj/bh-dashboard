-- (Superseded by 20260424150000_revert_po_email_open_tracking — do not add columns on new installs.)
-- Kept for migration history if this migration was already applied.
ALTER TABLE "order"."purchase_orders" ADD COLUMN IF NOT EXISTS "email_open_token" TEXT;
ALTER TABLE "order"."purchase_orders" ADD COLUMN IF NOT EXISTS "email_first_opened_at" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_email_open_token_key"
  ON "order"."purchase_orders" ("email_open_token")
  WHERE "email_open_token" IS NOT NULL;
