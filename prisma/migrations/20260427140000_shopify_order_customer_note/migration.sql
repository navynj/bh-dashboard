-- Customer order note from Shopify Admin / REST (`Order.note`).
ALTER TABLE "order"."shopify_orders" ADD COLUMN IF NOT EXISTS "customer_note" TEXT;
