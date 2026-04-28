-- Shopify Product GID on synced order lines (Admin product/variant deep links in Office UI).
ALTER TABLE "order"."shopify_order_line_items" ADD COLUMN "product_gid" TEXT;
