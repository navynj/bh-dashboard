-- Revert PO email open-tracking columns (if present).
DROP INDEX IF EXISTS "order"."purchase_orders_email_open_token_key";
ALTER TABLE "order"."purchase_orders" DROP COLUMN IF EXISTS "email_first_opened_at";
ALTER TABLE "order"."purchase_orders" DROP COLUMN IF EXISTS "email_open_token";
