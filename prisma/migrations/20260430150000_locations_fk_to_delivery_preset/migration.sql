-- Many `public.locations` rows may reference the same `delivery_location_presets` row.
-- Move the FK from preset→location to location→preset; backfill from legacy `presets.location_id`.

ALTER TABLE "public"."locations"
  ADD COLUMN IF NOT EXISTS "delivery_location_preset_id" TEXT;

CREATE INDEX IF NOT EXISTS "locations_delivery_location_preset_id_idx"
  ON "public"."locations" ("delivery_location_preset_id");

UPDATE "public"."locations" l
SET "delivery_location_preset_id" = p.id
FROM "public"."delivery_location_presets" p
WHERE p.location_id IS NOT NULL
  AND p.location_id = l.id;

ALTER TABLE "public"."delivery_location_presets"
  DROP CONSTRAINT IF EXISTS "delivery_location_presets_location_id_fkey";

DROP INDEX IF EXISTS "public"."delivery_location_presets_location_id_idx";

ALTER TABLE "public"."delivery_location_presets"
  DROP COLUMN IF EXISTS "location_id";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locations_delivery_location_preset_id_fkey'
  ) THEN
    ALTER TABLE "public"."locations"
      ADD CONSTRAINT "locations_delivery_location_preset_id_fkey"
      FOREIGN KEY ("delivery_location_preset_id")
      REFERENCES "public"."delivery_location_presets"("id")
      ON DELETE SET NULL;
  END IF;
END $$;
