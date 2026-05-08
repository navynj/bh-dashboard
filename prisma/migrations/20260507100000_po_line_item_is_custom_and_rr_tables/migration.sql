-- Add is_custom flag to purchase_order_line_items (hub-created lines not sourced from Shopify)
ALTER TABLE "order"."purchase_order_line_items"
  ADD COLUMN IF NOT EXISTS "is_custom" BOOLEAN NOT NULL DEFAULT FALSE;

-- Refund / replacement tracking tables
CREATE TABLE IF NOT EXISTS "order"."refund_replacement_records" (
  "id"                            TEXT          NOT NULL,
  "type"                          TEXT          NOT NULL,
  "reason_category"               TEXT          NOT NULL,
  "reason_subcategory"            TEXT          NOT NULL,
  "reason_notes"                  TEXT,
  "purchase_order_id"             TEXT          NOT NULL,
  "purchase_order_line_item_id"   TEXT,
  "shopify_order_id"              TEXT,
  "shopify_line_item_gid"         TEXT,
  "replacement_order_id"          TEXT,
  "product_title"                 TEXT          NOT NULL,
  "variant_title"                 TEXT,
  "sku"                           TEXT,
  "quantity"                      INTEGER       NOT NULL,
  "unit_price"                    DECIMAL(14,2),
  "created_by_id"                 TEXT,
  "created_at"                    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"                    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "refund_replacement_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refund_replacement_records_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "order"."purchase_orders"("id") ON DELETE CASCADE,
  CONSTRAINT "refund_replacement_records_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "refund_replacement_records_purchase_order_id_idx"
  ON "order"."refund_replacement_records"("purchase_order_id");
CREATE INDEX IF NOT EXISTS "refund_replacement_records_type_idx"
  ON "order"."refund_replacement_records"("type");
CREATE INDEX IF NOT EXISTS "refund_replacement_records_reason_category_idx"
  ON "order"."refund_replacement_records"("reason_category");
CREATE INDEX IF NOT EXISTS "refund_replacement_records_created_at_idx"
  ON "order"."refund_replacement_records"("created_at");
CREATE INDEX IF NOT EXISTS "refund_replacement_records_replacement_order_id_idx"
  ON "order"."refund_replacement_records"("replacement_order_id");

-- Reason options config table (single-row JSON store)
CREATE TABLE IF NOT EXISTS "order"."refund_reason_options" (
  "id"          TEXT        NOT NULL,
  "data"        JSONB       NOT NULL,
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "refund_reason_options_pkey" PRIMARY KEY ("id")
);
