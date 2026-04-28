-- Backfill Shopify Product GIDs across linked rows (no Admin API — DB only).
-- 1) Order line ← PO line when the PO line already has `shopify_product_gid`.
-- 2) PO line ← order line when sync filled `shopify_order_line_items.product_gid`.

UPDATE "order".shopify_order_line_items soli
SET product_gid = poli.shopify_product_gid
FROM "order".purchase_order_line_items poli
WHERE poli.shopify_order_line_item_id = soli.id
  AND poli.shopify_product_gid IS NOT NULL
  AND BTRIM(poli.shopify_product_gid) <> ''
  AND (soli.product_gid IS NULL OR BTRIM(soli.product_gid) = '');

UPDATE "order".purchase_order_line_items poli
SET shopify_product_gid = soli.product_gid
FROM "order".shopify_order_line_items soli
WHERE poli.shopify_order_line_item_id = soli.id
  AND soli.product_gid IS NOT NULL
  AND BTRIM(soli.product_gid) <> ''
  AND (poli.shopify_product_gid IS NULL OR BTRIM(poli.shopify_product_gid) = '');
