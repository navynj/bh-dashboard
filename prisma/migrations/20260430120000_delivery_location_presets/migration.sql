-- Public presets: ship-to addresses keyed to `locations` for office PO / Shopify create + future delivery UI.
CREATE TABLE IF NOT EXISTS "public"."delivery_location_presets" (
  "id"           TEXT        NOT NULL,
  "location_id"  TEXT        NOT NULL,
  "name"         TEXT        NOT NULL,
  "company"      TEXT,
  "address1"     TEXT        NOT NULL,
  "address2"     TEXT,
  "city"         TEXT        NOT NULL,
  "province"     TEXT        NOT NULL,
  "postal_code"  TEXT        NOT NULL,
  "country"      TEXT        NOT NULL DEFAULT 'CA',
  "lat"          DOUBLE PRECISION,
  "lng"          DOUBLE PRECISION,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "delivery_location_presets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_location_presets_location_id_fkey"
    FOREIGN KEY ("location_id")
    REFERENCES "public"."locations"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "delivery_location_presets_location_id_idx"
  ON "public"."delivery_location_presets" ("location_id");

ALTER TABLE "order"."purchase_orders"
  ADD COLUMN IF NOT EXISTS "delivery_location_preset_id" TEXT;

CREATE INDEX IF NOT EXISTS "purchase_orders_delivery_location_preset_id_idx"
  ON "order"."purchase_orders" ("delivery_location_preset_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_orders_delivery_location_preset_id_fkey'
  ) THEN
    ALTER TABLE "order"."purchase_orders"
      ADD CONSTRAINT "purchase_orders_delivery_location_preset_id_fkey"
      FOREIGN KEY ("delivery_location_preset_id")
      REFERENCES "public"."delivery_location_presets"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
