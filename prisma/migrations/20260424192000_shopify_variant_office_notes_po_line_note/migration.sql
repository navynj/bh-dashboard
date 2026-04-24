-- Default catalog note per Shopify variant (Admin ProductVariant GID).
CREATE TABLE "order"."shopify_variant_office_notes" (
    "id" TEXT NOT NULL,
    "shopify_variant_gid" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_variant_office_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopify_variant_office_notes_shopify_variant_gid_key"
  ON "order"."shopify_variant_office_notes" ("shopify_variant_gid");

-- PO line note (PDF + hub UI); optional override per PO line.
ALTER TABLE "order"."purchase_order_line_items"
  ADD COLUMN IF NOT EXISTS "note" TEXT;
