-- Synced product/variant image URL (Shopify order sync). Required for Prisma selects
-- that include `shopifyOrderLineItem` (e.g. office inbox `purchaseOrder.findMany`).
ALTER TABLE "order"."shopify_order_line_items"
  ADD COLUMN "image_url" TEXT;
